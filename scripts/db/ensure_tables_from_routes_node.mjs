import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

function requiredEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

function walkDir(dirPath) {
	const entries = fs.readdirSync(dirPath, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const full = path.join(dirPath, entry.name);
		if (entry.isDirectory()) files.push(...walkDir(full));
		else files.push(full);
	}
	return files;
}

function isRouteFile(filePath) {
	return filePath.endsWith(`${path.sep}route.ts`);
}

function normalizeTableName(name) {
	return String(name).replace(/[`"']/g, '').trim().toLowerCase();
}

const BUILTIN_CREATE_TABLES = new Map([
	[
		'placement_jobs',
		`
CREATE TABLE IF NOT EXISTS placement_jobs (
	Job_Id INT NOT NULL AUTO_INCREMENT,
	Company_Name VARCHAR(255) DEFAULT NULL,
	Company_Email VARCHAR(255) DEFAULT NULL,
	Job_Title VARCHAR(255) DEFAULT NULL,
	Job_Description TEXT DEFAULT NULL,
	Requirements TEXT DEFAULT NULL,
	Location VARCHAR(255) DEFAULT NULL,
	Package VARCHAR(100) DEFAULT NULL,
	Min_Percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
	Eligible_Courses TEXT DEFAULT NULL,
	Eligible_Batches TEXT DEFAULT NULL,
	Max_Backlogs INT NOT NULL DEFAULT 0,
	Application_Deadline DATETIME DEFAULT NULL,
	Status VARCHAR(30) NOT NULL DEFAULT 'Open',
	Token VARCHAR(128) DEFAULT NULL,
	Created_By INT DEFAULT NULL,
	Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	Updated_Date DATETIME DEFAULT NULL,
	IsDelete TINYINT NOT NULL DEFAULT 0,
	PRIMARY KEY (Job_Id),
	UNIQUE KEY uniq_token (Token),
	INDEX idx_status (Status),
	INDEX idx_isdelete (IsDelete),
	INDEX idx_created_date (Created_Date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`.trim(),
	],
	[
		'placement_applications',
		`
CREATE TABLE IF NOT EXISTS placement_applications (
	Application_Id INT NOT NULL AUTO_INCREMENT,
	Job_Id INT NOT NULL,
	Student_Id VARCHAR(50) NOT NULL,
	CV_Path VARCHAR(255) DEFAULT NULL,
	Cover_Letter TEXT DEFAULT NULL,
	Status VARCHAR(30) NOT NULL DEFAULT 'Applied',
	Remarks TEXT DEFAULT NULL,
	Applied_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	Screened_By INT DEFAULT NULL,
	Screened_Date DATETIME DEFAULT NULL,
	IsDelete TINYINT NOT NULL DEFAULT 0,
	PRIMARY KEY (Application_Id),
	UNIQUE KEY uniq_job_student (Job_Id, Student_Id),
	INDEX idx_job_id (Job_Id),
	INDEX idx_student_id (Student_Id),
	INDEX idx_status (Status),
	INDEX idx_isdelete (IsDelete),
	INDEX idx_applied_date (Applied_Date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`.trim(),
	],
	[
		'placement_emails',
		`
CREATE TABLE IF NOT EXISTS placement_emails (
	Email_Id INT NOT NULL AUTO_INCREMENT,
	Company_Email VARCHAR(255) NOT NULL,
	Company_Name VARCHAR(255) DEFAULT NULL,
	Subject VARCHAR(255) NOT NULL,
	Body TEXT DEFAULT NULL,
	Job_Submission_Link VARCHAR(512) DEFAULT NULL,
	Status VARCHAR(30) NOT NULL DEFAULT 'Draft',
	Created_By INT DEFAULT NULL,
	Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	IsDelete TINYINT NOT NULL DEFAULT 0,
	PRIMARY KEY (Email_Id),
	INDEX idx_company_email (Company_Email),
	INDEX idx_created_date (Created_Date),
	INDEX idx_isdelete (IsDelete)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`.trim(),
	],
	[
		'student_cvs',
		`
CREATE TABLE IF NOT EXISTS student_cvs (
	CV_Id INT NOT NULL AUTO_INCREMENT,
	Student_Id VARCHAR(50) NOT NULL,
	CV_Name VARCHAR(255) NOT NULL,
	CV_Path VARCHAR(255) NOT NULL,
	Is_Default TINYINT NOT NULL DEFAULT 0,
	Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	IsDelete TINYINT NOT NULL DEFAULT 0,
	PRIMARY KEY (CV_Id),
	INDEX idx_student_id (Student_Id),
	INDEX idx_isdelete (IsDelete),
	INDEX idx_created_date (Created_Date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`.trim(),
	],
	[
		'student_portal_auth',
		`
CREATE TABLE IF NOT EXISTS student_portal_auth (
	Id INT NOT NULL AUTO_INCREMENT,
	Student_Id VARCHAR(50) NOT NULL,
	Username VARCHAR(100) NOT NULL,
	Password_Hash CHAR(32) NOT NULL,
	IsActive TINYINT NOT NULL DEFAULT 1,
	Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	Last_Login DATETIME DEFAULT NULL,
	PRIMARY KEY (Id),
	UNIQUE KEY uniq_username (Username),
	INDEX idx_student_id (Student_Id),
	INDEX idx_isactive (IsActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`.trim(),
	],
	[
		'trainer_portal_auth',
		`
CREATE TABLE IF NOT EXISTS trainer_portal_auth (
	Id INT NOT NULL AUTO_INCREMENT,
	Faculty_Id INT NOT NULL,
	Username VARCHAR(100) NOT NULL,
	Password_Hash CHAR(32) NOT NULL,
	IsActive TINYINT NOT NULL DEFAULT 1,
	Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	Last_Login DATETIME DEFAULT NULL,
	PRIMARY KEY (Id),
	UNIQUE KEY uniq_username (Username),
	INDEX idx_faculty_id (Faculty_Id),
	INDEX idx_isactive (IsActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`.trim(),
	],
	[
		'trainer_attendance',
		`
CREATE TABLE IF NOT EXISTS trainer_attendance (
	Id INT NOT NULL AUTO_INCREMENT,
	Faculty_Id INT NOT NULL,
	Batch_Id INT DEFAULT NULL,
	Attend_Date DATE NOT NULL,
	Check_In TIME DEFAULT NULL,
	Check_Out TIME DEFAULT NULL,
	Status VARCHAR(30) NOT NULL DEFAULT 'Present',
	Remarks TEXT DEFAULT NULL,
	Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (Id),
	UNIQUE KEY uniq_faculty_date (Faculty_Id, Attend_Date),
	INDEX idx_faculty_id (Faculty_Id),
	INDEX idx_attend_date (Attend_Date),
	INDEX idx_batch_id (Batch_Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`.trim(),
	],
]);

function extractReferencedTablesFromText(text) {
	// Heuristic: grab identifiers after common SQL keywords.
	// Not a full SQL parser, but good enough when run ONLY on SQL strings.
	const tables = new Set();
	const stop = new Set([
		'select',
		'where',
		'on',
		'and',
		'or',
		'order',
		'group',
		'limit',
		'inner',
		'left',
		'right',
		'cross',
		'outer',
		'union',
		'having',
		'as',
		'values',
		'set',
		'case',
		'when',
		'then',
		'end',
		'distinct',
		'using',
		'current_date',
		'current_timestamp',
	]);

	const re = /(from|join|into|update|delete\s+from|alter\s+table|truncate\s+table|references)\s+((?:`[^`]+`|[a-zA-Z_][\w$]*)(?:\s*\.\s*(?:`[^`]+`|[a-zA-Z_][\w$]*))?)/gi;
	let m;
	while ((m = re.exec(text)) !== null) {
		let raw = (m[2] || '').trim();
		if (!raw) continue;
		if (raw.includes('(') || raw.includes(')')) continue;
		raw = raw.replace(/\s+/g, '');
		const parts = raw.split('.');
		const name = normalizeTableName(parts[parts.length - 1]);
		if (!name) continue;
		if (name.length < 2) continue;
		if (name.startsWith('tmp_')) continue;
		if (stop.has(name)) continue;
		if (name === 'information_schema' || name === 'performance_schema' || name === 'mysql' || name === 'sys') continue;
		tables.add(name);
	}
	return tables;
}

function extractSqlLiteralsFromCode(text) {
	// Extract SQL string literals passed as the first argument to `.execute(` or `.query(`.
	// This avoids scanning the whole TS file and drastically reduces false positives.
	const sqls = [];
	const needles = ['.execute(', '.query('];

	function isEscaped(str, idx) {
		let backslashes = 0;
		for (let i = idx - 1; i >= 0 && str[i] === '\\'; i -= 1) backslashes += 1;
		return backslashes % 2 === 1;
	}

	function readQuoted(startIdx) {
		const quote = text[startIdx];
		let i = startIdx + 1;
		let out = '';
		while (i < text.length) {
			const ch = text[i];
			if (ch === quote && !isEscaped(text, i)) {
				return { value: out, end: i + 1 };
			}
			out += ch;
			i += 1;
		}
		return null;
	}

	for (const needle of needles) {
		let idx = 0;
		while ((idx = text.indexOf(needle, idx)) !== -1) {
			let i = idx + needle.length;
			while (i < text.length && /\s/.test(text[i])) i += 1;
			const ch = text[i];
			if (ch !== '`' && ch !== '"' && ch !== "'") {
				idx = i;
				continue;
			}
			const parsed = readQuoted(i);
			if (parsed?.value) {
				const cleaned = parsed.value.replace(/\$\{[^}]*\}/g, '');
				sqls.push(cleaned);
				idx = parsed.end;
			} else {
				idx = i + 1;
			}
		}
	}

	return sqls;
}

function findCreateTableSqlBlocksInCode(text) {
	// Attempt to extract full CREATE TABLE... blocks from template literals
	const blocks = new Map();
	const needleRe = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([`\w]+)/gi;
	let m;
	while ((m = needleRe.exec(text)) !== null) {
		const rawName = m[1];
		const name = normalizeTableName(rawName);
		const idx = m.index;

		// Find nearest surrounding backticks (template literal) so we can grab the full SQL
		const before = text.lastIndexOf('`', idx);
		const after = text.indexOf('`', idx);
		if (before === -1 || after === -1 || after <= before) continue;
		const sql = text.slice(before + 1, after).trim();
		if (!sql.toLowerCase().includes('create table')) continue;
		blocks.set(name, sql);
	}
	return blocks;
}

function ensureIfNotExists(createSql) {
	return createSql.replace(/\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ');
}

function rewriteEngineToMyISAM(createSql) {
	if (/engine\s*=\s*myisam/i.test(createSql)) return createSql;
	if (/engine\s*=\s*innodb/i.test(createSql)) {
		return createSql.replace(/ENGINE\s*=\s*InnoDB/gi, 'ENGINE=MyISAM');
	}
	// If no engine specified, append one at end (before optional charset)
	return createSql;
}

async function loadCreateTableMapFromDump({ dumpPath, wantTables }) {
	const want = new Set([...wantTables].map((t) => normalizeTableName(t)));
	const found = new Map();
	if (!fs.existsSync(dumpPath) || want.size === 0) return found;

	const stream = fs.createReadStream(dumpPath, { encoding: 'utf8' });
	const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

	let capturing = false;
	let captureName = '';
	let buf = [];

	const startRe = /^\s*CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?`?([\w]+)`?/i;

	for await (const line of rl) {
		if (!capturing) {
			const m = startRe.exec(line);
			if (!m) continue;
			const name = normalizeTableName(m[2]);
			if (!want.has(name)) continue;
			capturing = true;
			captureName = name;
			buf = [line];
			continue;
		}

		buf.push(line);
		if (line.trim().endsWith(';')) {
			const sql = buf.join('\n').trim();
			found.set(captureName, sql);
			capturing = false;
			captureName = '';
			buf = [];
			if (found.size === want.size) break;
		}
	}

	rl.close();
	stream.close();
	return found;
}

function isRetryableFkError(code) {
	return (
		code === 'ER_CANNOT_ADD_FOREIGN' ||
		code === 'ER_CANNOT_ADD_FOREIGN_KEY' ||
		code === 'ER_FK_CANNOT_OPEN_PARENT' ||
		code === 'ER_NO_REFERENCED_ROW_2'
	);
}

async function main() {
	dotenv.config({ path: '.env.local' });
	const host = requiredEnv('DB_HOST');
	const user = requiredEnv('DB_USER');
	const password = requiredEnv('DB_PASSWORD');
	const database = requiredEnv('DB_NAME');
	const port = Number(process.env.DB_PORT || 3306);

	if (process.env.ENSURE_TABLES_CONFIRM !== 'YES') {
		throw new Error(
			"Refusing to run: set ENSURE_TABLES_CONFIRM=YES to scan routes and create missing tables in the remote DB.",
		);
	}

	const workspaceRoot = process.cwd();
	const apiRoot = path.join(workspaceRoot, 'app', 'api');
	const dumpPath = path.join(workspaceRoot, 'public', 'database.sql');

	const files = walkDir(apiRoot).filter(isRouteFile);
	console.log(`Scanning ${files.length} route files...`);

	const referenced = new Set();
	const codeCreateMap = new Map();

	for (const file of files) {
		const text = fs.readFileSync(file, 'utf8');
		for (const sql of extractSqlLiteralsFromCode(text)) {
			for (const t of extractReferencedTablesFromText(sql)) referenced.add(t);
		}
		for (const [name, sql] of findCreateTableSqlBlocksInCode(text)) {
			if (!codeCreateMap.has(name)) codeCreateMap.set(name, sql);
		}
	}

	console.log(`Referenced tables (heuristic): ${referenced.size}`);

	const conn = await mysql.createConnection({ host, user, password, database, port });
	try {
		const [rows] = await conn.query(
			"SELECT table_name FROM information_schema.tables WHERE table_schema=?",
			[database],
		);
		const existing = new Set(rows.map((r) => normalizeTableName(r.table_name)));

		const missing = [...referenced].filter((t) => !existing.has(normalizeTableName(t)));
		missing.sort();

		console.log(`Existing tables: ${existing.size}`);
		console.log(`Missing referenced tables: ${missing.length}`);
		if (missing.length === 0) {
			console.log('Nothing to do.');
			return;
		}

		// Build create SQL map for missing tables
		const wantSet = new Set(missing);
		const dumpCreateMap = await loadCreateTableMapFromDump({ dumpPath, wantTables: wantSet });

		const createMap = new Map();
		for (const t of missing) {
			const name = normalizeTableName(t);
			if (codeCreateMap.has(name)) createMap.set(name, codeCreateMap.get(name));
			else if (dumpCreateMap.has(name)) createMap.set(name, dumpCreateMap.get(name));
			else if (BUILTIN_CREATE_TABLES.has(name)) createMap.set(name, BUILTIN_CREATE_TABLES.get(name));
		}

		const unresolved = missing.filter((t) => !createMap.has(normalizeTableName(t)));
		if (unresolved.length) {
			console.log('Missing tables with no CREATE TABLE definition found (code or dump):');
			console.log(unresolved.join(', '));
		}

		let pending = missing
			.map((t) => normalizeTableName(t))
			.filter((t) => createMap.has(t));
		pending = [...new Set(pending)];

		console.log(`Creatable missing tables: ${pending.length}`);

		const failures = new Map();
		let madeProgress = true;
		let pass = 0;

		while (pending.length && madeProgress && pass < 10) {
			pass += 1;
			madeProgress = false;
			const next = [];

			for (const t of pending) {
				let sql = createMap.get(t);
				sql = ensureIfNotExists(sql);

				try {
					await conn.query(sql);
					console.log(`Created: ${t}`);
					madeProgress = true;
					continue;
				} catch (e) {
					const code = e?.code;
					if (code === 'ER_TABLE_EXISTS_ERROR') {
						madeProgress = true;
						continue;
					}
					if (code === 'ER_TOO_BIG_ROWSIZE') {
						try {
							const retrySql = rewriteEngineToMyISAM(sql);
							await conn.query(retrySql);
							console.log(`Created (MyISAM fallback): ${t}`);
							madeProgress = true;
							continue;
						} catch (e2) {
							failures.set(t, { code: e2?.code, message: e2?.message });
							next.push(t);
							continue;
						}
					}

					if (isRetryableFkError(code)) {
						failures.set(t, { code, message: e?.message });
						next.push(t);
						continue;
					}

					failures.set(t, { code, message: e?.message });
					// Not retrying unknown errors; drop from pending.
				}
			}

			pending = next;
			if (pending.length) console.log(`Pass ${pass} done. Still pending: ${pending.length}`);
		}

		if (pending.length) {
			console.log('Tables still pending (likely due to FK ordering issues):');
			console.log(pending.join(', '));
		}

		// Final DB check: which missing tables now exist?
		const [afterRows] = await conn.query(
			"SELECT table_name FROM information_schema.tables WHERE table_schema=?",
			[database],
		);
		const afterExisting = new Set(afterRows.map((r) => normalizeTableName(r.table_name)));
		const stillMissing = missing.filter((t) => !afterExisting.has(normalizeTableName(t)));

		console.log(`Created (verified): ${missing.length - stillMissing.length}/${missing.length}`);
		if (stillMissing.length) {
			console.log('Still missing:');
			console.log(stillMissing.join(', '));
		}

		if (failures.size) {
			console.log('Failures summary (last error per table):');
			for (const [t, f] of failures.entries()) {
				console.log(`- ${t}: ${f.code || 'UNKNOWN'} ${f.message || ''}`);
			}
		}
	} finally {
		await conn.end();
	}
}

await main();
