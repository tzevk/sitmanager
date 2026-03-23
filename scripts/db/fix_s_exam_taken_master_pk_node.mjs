import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

function requiredEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

function nowStamp() {
	const d = new Date();
	const pad = (n) => String(n).padStart(2, '0');
	return (
		d.getFullYear() +
		pad(d.getMonth() + 1) +
		pad(d.getDate()) +
		'_' +
		pad(d.getHours()) +
		pad(d.getMinutes()) +
		pad(d.getSeconds())
	);
}

async function main() {
	dotenv.config({ path: '.env.local' });
	const host = requiredEnv('DB_HOST');
	const user = requiredEnv('DB_USER');
	const password = requiredEnv('DB_PASSWORD');
	const database = requiredEnv('DB_NAME');
	const port = Number(process.env.DB_PORT || 3306);

	if (process.env.FIX_EXAM_TAKEN_CONFIRM !== 'YES') {
		throw new Error(
			"Refusing to run: set FIX_EXAM_TAKEN_CONFIRM=YES to dedupe and alter 'S_Exam_Taken_Master'.",
		);
	}

	const table = 'S_Exam_Taken_Master';
	const backupTable = `${table}__bak_${nowStamp()}`;

	const conn = await mysql.createConnection({
		host,
		user,
		password,
		database,
		port,
		multipleStatements: false,
	});

	try {
		console.log(`Connected. Checking ${database}.${table} ...`);

		const [[exists]] = await conn.query(
			"SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=? AND table_name=?",
			[database, table],
		);
		if (!exists?.c) throw new Error(`Table does not exist: ${database}.${table}`);

		const [[counts]] = await conn.query(
			`SELECT COUNT(*) AS row_count, COUNT(DISTINCT Take_Id) AS distinct_take_id FROM ${table}`,
		);
		console.log('Current counts:', counts);

		// Safety check: if any Take_Id has 2+ rows that are not identical, abort.
		// (If duplicates are identical, we'll delete extras safely.)
		const [nonIdentical] = await conn.query(
			`SELECT Take_Id
			 FROM (
				SELECT
					Take_Id,
					COUNT(*) AS c,
					COUNT(DISTINCT CONCAT_WS('#',
						COALESCE(Course_Id, 'NULL'),
						COALESCE(Batch_Id, 'NULL'),
						COALESCE(Exam_Id, 'NULL'),
						COALESCE(DATE_FORMAT(Exam_Dt, '%Y-%m-%d %H:%i:%s.%f'), 'NULL'),
						COALESCE(IsActive, 'NULL'),
						COALESCE(IsDelete, 'NULL')
					)) AS cd
				FROM ${table}
				GROUP BY Take_Id
			 ) x
			 WHERE x.c > 1 AND x.cd > 1
			 LIMIT 5`,
		);
		if (nonIdentical.length) {
			console.table(nonIdentical);
			throw new Error(
				'Detected non-identical duplicate Take_Id rows. Aborting to avoid data loss.',
			);
		}

		const [dupIds] = await conn.query(
			`SELECT Take_Id, COUNT(*) AS c FROM ${table} GROUP BY Take_Id HAVING c>1 ORDER BY c DESC LIMIT 10`,
		);
		if (dupIds.length) {
			console.log('Sample duplicate Take_Id values:');
			console.table(dupIds);
		}

		console.log(`Creating backup table ${backupTable} ...`);
		await conn.query(`RENAME TABLE ${table} TO ${backupTable}`);

		console.log(`Recreating ${table} from backup (deduped) ...`);
		await conn.query(`CREATE TABLE ${table} LIKE ${backupTable}`);
		await conn.query(`INSERT INTO ${table} SELECT DISTINCT * FROM ${backupTable}`);

		const [[afterCounts]] = await conn.query(
			`SELECT COUNT(*) AS row_count, COUNT(DISTINCT Take_Id) AS distinct_take_id FROM ${table}`,
		);
		console.log('After dedupe counts:', afterCounts);

		console.log('Restoring PRIMARY KEY + AUTO_INCREMENT on Take_Id ...');
		await conn.query(`ALTER TABLE ${table} MODIFY Take_Id int NOT NULL`);
		await conn.query(`ALTER TABLE ${table} ADD PRIMARY KEY (Take_Id)`);

		const [[maxRow]] = await conn.query(
			`SELECT COALESCE(MAX(Take_Id), 0) AS max_id FROM ${table}`,
		);
		const nextId = Number(maxRow.max_id) + 1;
		await conn.query(
			`ALTER TABLE ${table} MODIFY Take_Id int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=${nextId}`,
		);

		console.log('Done. Backup preserved as:', backupTable);
	} catch (e) {
		console.error('Fix failed:', e?.message || e);
		console.error('Leaving DB in its current state.');
		process.exitCode = 1;
	} finally {
		await conn.end();
	}
}

await main();
