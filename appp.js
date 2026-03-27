const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const app = express();
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
var { SendMailClient } = require("zeptomail");
const { writeLog } = require("./Routes/utility/log.js");
const https = require('https');
const axios = require("axios");
const batchmoving = require("./Routes/account/batchmoving.js");
const employeeloan = require("./Routes/account/employeeloan.js");
const festivaluload = require("./Routes/utility/UploadFestival.js");
const uploadevent = require("./Routes/utility/UploadEvent.js");
const uploadexcel = require("./Routes/Batch/uploadExcel.js");
const uploadtestimonial = require("./Routes/utility/uploadtestimonial.js");
const uploadBanner = require("./Routes/utility/UploadBanner.js");
const voucher = require("./Routes/account/GenerateVoucherNo.js");
const projectmaster = require("./Routes/account/projectMaster.js");
const generateresult = require("./Routes/DailyAactivity/GenerateResult.js");
const ImportAttendance = require("./Routes/DailyAactivity/ImportAttendance.js");
const qmsdoes = require("./Routes/utility/QmsDose.js");
const emailmaster = require("./Routes/utility/EmailMaster.js");
const Consultant_Mst = require("./Routes/utility/Consultant_Mst.js");
const Consultant_Branch = require("./Routes/utility/Consultant_Branch.js");
const Consultant_FollowUp = require("./Routes/utility/Consultant_FollowUp.js");
const CV_Shortlisted = require("./Routes/utility/CV_Shortlisted.js");
const CV_Child = require("./Routes/utility/CV_Child.js");
const apisR = require("./Routes/Utils/apis.js");
const SearchResult = require("./Routes/Utils/SearchResult.js");
const SearchInquiry = require("./Routes/Utils/SearchInquiry.js");
const SearchLectureTaken = require("./Routes/Utils/SearchLectureTaken.js");
const LatestVvUpdate = require("./Routes/Placement/LatestVvUpdate.js");
const ConsultantReport = require("./Routes/Placement/ConsultantReport.js");
const CompanyReuirement = require("./Routes/Placement/CompanyReuirement.js");
const Employee = require("./Routes/Master/Employee.js")
const FacultySalaryReport = require("./Routes/Report/FacultySalaryReport.js");
const CorporateRecordReport = require("./Routes/Report/CorporateRecordReport.js");
const ChequeandReceipt = require("./Routes/Report/ChequeandReceipt.js");
// const Test_mail = require("./Routes/Utils/Test_mail")
// Use CORS middleware



const url = "api.zeptomail.in/";
const token =
    "Zoho-enczapikey PHtE6r0IF+m52WZ5oUIF4PbpFs/3YNgr/uIyLFMT5I9BW/4AFk0GrIgvwzOwrhh+BPZAFPWcnd05sbie5+vQc2q+ZG1NDmqyqK3sx/VYSPOZsbq6x00asFscckLcXYHodddi0SDSudbdNA==";

app.use(
    cors({
        origin: "*", // Allow all origins
    })
);
function imageToBase64(studentId, fileName) {
    if (!fileName) return null;

    const filePath = path.join(__dirname, "../uploads/student_document/", studentId.toString(), fileName);

    if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath);
        // Always serve JPEG to avoid PDF blank PNG issue
        return `data:image/jpeg;base64,${fileData.toString("base64")}`;
    } else {
        return null;
    }
}

const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

// Parse incoming JSON requests
app.use(express.json({ limit: "50mb" })); // Adjust the limit as needed
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Define routes
app.use("/nodeapp", batchmoving);
app.use("/nodeapp", employeeloan);
app.use("/nodeapp", festivaluload);
app.use("/nodeapp", uploadevent);
app.use("/nodeapp", uploadexcel);
app.use("/nodeapp", uploadtestimonial);
app.use("/nodeapp", uploadBanner);
app.use("/nodeapp", voucher);
app.use("/nodeapp", projectmaster);
app.use("/nodeapp", generateresult);
app.use("/nodeapp", qmsdoes);
app.use("/nodeapp", emailmaster);
app.use("/nodeapp", Consultant_Mst);
app.use("/nodeapp", Consultant_Branch);
app.use("/nodeapp", Consultant_FollowUp);
app.use("/nodeapp", CV_Shortlisted);
app.use("/nodeapp", CV_Child);
app.use("/nodeapp", apisR);
app.use("/nodeapp", SearchResult);
app.use("/nodeapp", ImportAttendance);
app.use("/nodeapp", SearchLectureTaken);
app.use("/nodeapp", SearchInquiry);
app.use("/nodeapp", LatestVvUpdate);
app.use("/nodeapp", ConsultantReport);
app.use("/nodeapp", CompanyReuirement);
app.use("/nodeapp", Employee);
app.use("/nodeapp", FacultySalaryReport);
app.use("/nodeapp", CorporateRecordReport);
app.use("/nodeapp", ChequeandReceipt);
// app.use("/nodeapp", Test_mail);

// Error handling middleware (optional)
// Universal Error Handler Middleware
app.use((err, req, res, next) => {
    console.error("❌ Universal Error Handler:", err);

    // Log to file if needed
    writeLog(`Universal Error: ${err.message}\nStack: ${err.stack}`);

    res.status(err.status || 500).json({
        status: "error",
        message: err.message || "Internal Server Error",
        // Uncomment below line only in development
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
});


process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
    writeLog(`Unhandled Rejection: ${reason}`);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    writeLog(`Uncaught Exception: ${err.message}\nStack: ${err.stack}`);
    process.exit(1); // optional - consider restarting with PM2 or forever
});




const JWT_SECRET = "satyam";


const storage = multer.memoryStorage(); // for buffer access
const upload = multer({ storage: storage });

// Create a connection pool with the required details
const con = mysql.createPool({
    connectionLimit: 100,  // increased
    host: "localhost", // Replace with your host name
    user: "abhishek_sit", // Replace with your database username
    password: "5CM#KDD@KE", // Replace with your database password
    database: "abhishek_sit", // Replace with your database name
});

// const con = mysql.createPool({
//   host: 'localhost',   // Replace with your host name
//   user: 'root',        // Replace with your database username
//   password: '', // Replace with your database password
//   database: 'sit'  // Replace with your database name
// });

con.getConnection((err, connection) => {
    if (err) {
        writeLog("Error connecting to the database:", err);
    } else {
        writeLog("Successfully connected to the database");
        connection.release(); // Release the connection back to the pool
    }
});

app.get("/nodeapp/node", (req, res) => {
    return res.json("This is satyam ");
});

app.get("/nodeapp/bhainode", (req, res) => {
    res.json({ time: Date.now(), msg: "🔥 RESPONSE 🔥" });
});


app.listen("30000", () => {
    console.log("listening");
    // writeLog("Server listening on 30000");
});



app.get("/nodeapp/restart", (req, res) => {
    const restartFilePath = path.join(__dirname, "tmp", "restart.txt");

    fs.writeFile(restartFilePath, "Restarting app", (err) => {
        if (err) {
            console.error("Failed to write restart.txt:", err);
            return res.status(500).json({ success: false, message: "Failed to trigger restart" });
        }

        res.json({ success: true, message: "Restart triggered" });
    });
});


// // Read your PDF file and convert it to base64
// const pdfBuffer = fs.readFileSync('path/to/test.pdf');
// const base64Pdf = pdfBuffer.toString('base64');


app.post("/nodeapp/login", (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    let role = req.body.role;

    const sql = "select * from awt_adminuser where email = ? and password = ? and role = ? and deleted = 0";

    con.query(sql, [email, password, role], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            if (data.length > 0) {
                const id = data[0].id;
                // req.session.id = id;
                const token = jwt.sign({ id: id }, JWT_SECRET, { expiresIn: "12h" });
                return res.json({ data, id: id, token: token });
            }
        }

    });
});

app.get("/nodeapp/protected", (req, res) => {
    const token = req.headers["authorization"];

    if (!token) {
        return res.status(401).json({ message: "Token is missing" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ message: "This is a protected route", user: decoded });
    } catch (error) {
        res.status(401).json({ message: "Invalid token" });
    }
});

// app.get('/nodeapp/checkauth', (req, res) => {
//   if (req.session.id) {
//     return res.json({ valid: true, sessionid: req.session.id })
//   } else {
//     return res.json({ valid: false })
//   };
// });



app.post("/nodeapp/add_data", (req, res) => {
    let title = req.body.title;
    let created_date = new Date();
    let uid = req.body.uid;
    let user_id = req.body.user_id;
    let tablename = req.body.tablename;

    let sql;
    let param;
    if (uid == undefined) {
        sql = `insert into ${tablename} (title,created_by,created_date) values(?,?,?)`;
        param = [title, user_id, created_date];
    } else {
        sql = `update ${tablename} set title = ?, updated_by = ?, updated_date = ? where id =?`;
        param = [title, user_id, created_date, uid];
    }

    con.query(sql, param, (err, data) => {
        console.log(sql);
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.post("/nodeapp/update_data", (req, res) => {
    let u_id = req.body.u_id;
    let tablename = req.body.tablename;

    const sql = `select * from ${tablename} where id = ?`;

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/new_update_data", (req, res) => {
    let u_id = req.body.u_id;
    let tablename = req.body.tablename;
    let uidname = req.body.uidname;

    const sql = `select * from ${tablename} where ${uidname} = ?`;

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/update_library_data", (req, res) => {
    let u_id = req.body.u_id;
    let tablename = req.body.tablename;

    const sql = `select * from ${tablename} where Book_Id = ?`;

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/get_data", (req, res) => {
    let tablename = req.body.tablename;
    let columnname = req.body.columnname;

    if (columnname == undefined) {
        const sql = `select * from ${tablename} where deleted = 0 `;

        con.query(sql, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    } else {
        const sql = `select ${columnname} from ${tablename} where deleted = 0 `;

        con.query(sql, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    }
});


app.post("/nodeapp/get_qms_data", (req, res) => {

    const sql = `SELECT q.* , m.QMS_name , r.title FROM awt_qmsdoes as q left join role  as r on r.id = q.department left join qms_master as m on m.Id =q.qmsname where q.deleted = 0 and r.delete = 0 and m.IsDelete = 0; `;

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });

});




app.post("/nodeapp/get_new_data", (req, res) => {
    let tablename = req.body.tablename;
    let columnname = req.body.columnname;

    const sql = `select ${columnname} from ${tablename} where isDelete = 0 `;

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getStudentAllInformation", (req, res) => {

    const batch_code = req.body.batch_code;

    const sql = `select 
    s.Student_Name, 
    s.DOB, 
    s.Present_Address,
    s.Email, 
    s.Present_Mobile, 
    a.Qualification, 
    a.Discipline, 
    a.PassingYear, 
    c.Company, 
    c.Duration, 
    b.Batch_code, 
    b.SDate, 
    b.EDate, 
    cm.Course_Name, 
    am.Student_Code 
    from Student_Master as s LEFT JOIN awt_academicqualification as a on a.Student_id = s.Student_id LEFT JOIN Company_info as c on c.Student_id = s.Student_id Left Join Course_Mst as cm on cm.Course_Id = s.Course_Id LEFT Join Admission_master as am on am.Student_id = s.Student_id LEFT JOIN Batch_Mst AS b ON b.Batch_Id = am.Batch_Id where s.IsDelete = 0 AND s.Batch_Code = ?`;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/delete_data", (req, res) => {
    let cat_id = req.body.cat_id;
    let tablename = req.body.tablename;

    const sql = `update ${tablename} set deleted = 1 where id = ?`;

    con.query(sql, [cat_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/new_delete_data", (req, res) => {
    let delete_id = req.body.delete_id;
    let tablename = req.body.tablename;
    let column_name = req.body.column_name;

    const sql = `update ${tablename} set IsDelete = 1 where ${column_name} = ?`;

    con.query(sql, [delete_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/delete_corporate_data", (req, res) => {
    let cat_id = req.body.cat_id;
    let tablename = req.body.tablename;

    const sql = `update ${tablename} set IsDelete = 1 where Id = ?`;

    con.query(sql, [cat_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/delete_employeedata", (req, res) => {
    let cat_id = req.body.cat_id;
    let tablename = req.body.tablename;

    const sql = `update ${tablename} set deleted = 1 where Training_id = ?`;

    con.query(sql, [cat_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/delete_employerecord_data", (req, res) => {
    let cat_id = req.body.cat_id;
    let tablename = req.body.tablename;

    const sql = `update ${tablename} set deleted = 1 where id = ?`;

    con.query(sql, [cat_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/vendor_details", (req, res) => {
    const sql = `select * from awt_vendor_master where deleted = 0 `;

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.get("/nodeapp/getassetcat", (req, res) => {
    const sql = `select * from awt_asset_category where deleted = 0`;

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_vendor", (req, res) => {
    let {
        vendorname,
        email,
        telephone,
        type,
        address,
        country,
        state,
        city,
        pin,
        contactperson,
        mobile,
        fax,
        comments,
        uid,
    } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql =
            "insert into awt_vendor_master(`vendorname`,`email`,`telephone`,`type`,`address`,`country`,`state`,`city`,`pin`,`contactperson`,`mobile`,`fax`,`comment`) values(?,?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            vendorname,
            email,
            telephone,
            type,
            address,
            country,
            state,
            city,
            pin,
            contactperson,
            mobile,
            fax,
            comments,
        ];
    } else {
        sql =
            "update `awt_vendor_master` set `vendorname` =? , `email` =? , `telephone` =? , `type` =? , `address` =? , `country` =? , `state` =? , `city` =? , `pin` =? , `contactperson` =? , `mobile` =? , `fax` =? , `comments` =? where id =?";

        param = [
            vendorname,
            email,
            telephone,
            type,
            address,
            country,
            state,
            city,
            pin,
            contactperson,
            mobile,
            fax,
            comments,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_course", (req, res) => {
    let { course, course_code, eligibility, introduction, keypoint, objective, studyprep, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into Course_Mst(`Course_Name`,`Course_Code`,`Eligibility`,`Introduction`,`Course_Description`,`Objective`,`Basic_Subject`) values(?,?,?,?,?,?,?)";

        param = [course, course_code, eligibility, introduction, keypoint, objective, studyprep];
    } else {
        sql =
            "update `Course_Mst` set `Course_Name` =? , `Course_Code` =? , `Eligibility` =? , `Introduction` =? , `Course_Description` =? , `Objective` =? , `Basic_Subject` =?  where `Course_Id` =?";

        param = [course, course_code, eligibility, introduction, keypoint, objective, studyprep, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/batch_category", (req, res) => {
    let { batch, batchtype, prefix, description, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into MST_BatchCategory(`BatchCategory`,`Batch_Type`,`Prefix`,`Description`) values(?,?,?,?)";

        param = [batch, batchtype, prefix, description];
    } else {
        sql =
            "update `MST_BatchCategory` set `BatchCategory` = ? , `Batch_Type` = ? , `Prefix` = ? , `Description` = ? where id =?";

        param = [batch, batchtype, prefix, description, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_college", (req, res) => {
    let {
        college_name,
        university,
        contact_person,
        designation,
        address,
        city,
        pin,
        country,
        state,
        telephone,
        mobile,
        email,
        website,
        remark,
        purpose,
        course,
        refstudentname,
        refmobile,
        refemail,
        batch,
        desciplinevalue,
        uid,
    } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into awt_college(`college_name`,`university`,`contact_person`,`designation`,`address`,`city`,`pin`,`country`,`state`,`telephone`,`mobile`,`email`,`website`,`remark`,`purpose`,`course`,`refstudentname`,`refmobile`,`refemail`,`batch`,`descipline`) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            college_name,
            university,
            contact_person,
            designation,
            address,
            city,
            pin,
            country,
            state,
            telephone,
            mobile,
            email,
            website,
            remark,
            purpose,
            course,
            refstudentname,
            refmobile,
            refemail,
            batch,
            desciplinevalue,
        ];
    } else {
        sql =
            "update `awt_college` set `college_name` =? , `university` =? , `contact_person` =? , `designation` =? , `address` =? , `city` =? , `pin` =? , `country` =? , `state` =? , `telephone` =? , `mobile` =? , `email` =? , `website` =? , `remark` =? , `purpose` =? , `course` =? ,refstudentname =?,refmobile =?,batch =?,descipline =?,refemail = ? where id =?";

        param = [
            college_name,
            university,
            contact_person,
            designation,
            address,
            city,
            pin,
            country,
            state,
            telephone,
            mobile,
            email,
            website,
            remark,
            purpose,
            course,
            refstudentname,
            refmobile,
            batch,
            desciplinevalue,
            refemail,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/add_college_follow", (req, res) => {
    let {
        collegeid,
        date,
        contactperson,
        designation,
        purpose,
        directline,
        email,
        nextdate,
        remark,
        note,
        mobile,
        descipline,
        uid,
    } = req.body;

    let sql;
    let param;

    if (uid == "") {
        sql =
            "insert Into College_Follows( `College_id`,`Tdate`,`CName`,`Designation`,`Purpose`,`DirectLine`,`Email`,`nextdate`,`Remark`,`Note`,`Phone`,`Discipline`) values(?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            collegeid,
            date,
            contactperson,
            designation,
            purpose,
            directline,
            email,
            nextdate,
            remark,
            note,
            mobile,
            descipline,
        ];
    } else {
        sql =
            "update `College_Follows` set College_id = ? , Tdate = ?,CName = ? ,Designation = ? ,Purpose = ? ,DirectLine = ? ,Email = ? , nextdate = ? ,Remark = ? ,Note = ? ,Phone = ? ,Discipline = ? where Follow_id = ? ";

        param = [
            collegeid,
            date,
            contactperson,
            designation,
            purpose,
            directline,
            email,
            nextdate,
            remark,
            note,
            mobile,
            descipline,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/add_feedback", (req, res) => {
    let { questionfor, category, question, selection, order, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into awt_feedback(`questionfor`,`category`,`question`,`selection`,`order`) values(?,?,?,?,?)";

        param = [questionfor, category, question, selection, order];
    } else {
        sql =
            "update `awt_feedback` set `questionfor` =? , `category` =? , `question` =? , `selection` =? , `order` =? where id = ?";

        param = [questionfor, category, question, selection, order, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_faculty_master", (req, res) => {
    let {
        Faculty_Code,
        Faculty_Name,
        Married,
        DOB,
        Nationality,
        Faculty_Type,
        Office_Tel,
        Res_Tel,
        Mobile,
        EMail,
        Present_Address,
        Present_City,
        Present_State,
        Present_Country,
        Present_Pin,
        Present_Tel,
        Permanent_Address,
        Permanent_City,
        Permanent_State,
        Permanent_Country,
        Permanent_Pin,
        Permanent_Tel,
        Service_Offered,
        Specialization,
        Experience,
        Company_Name,
        Company_Address,
        Company_Phone,
        Interview_Date,
        Working_At,
        Qualified,
        Joining_Date,
        Comments,
        Interviewer,
        Sal_Struct,
        Salary,
        Date_added,
        TDS,
        PAN,
        Resigned,
        InvoiceName,
        IsActive,
        IsDelete,
        CourseId,
        DesignExp,
        KnowSw,
        Working_Status,
        TrainingCategory,
        Interview_Status,
        Reference_by,
        uid,
    } = req.body;


    if (uid == undefined) {
        const getMaxCodeQuery = "SELECT Faculty_Code AS maxCode FROM faculty_master order by Faculty_Id desc limit 1";

        con.query(getMaxCodeQuery, (err, result) => {
            if (err) return res.json(err);

            const newFacultyCode = (result[0].maxCode || 0) + 1;
            const insertSql =
                "insert into faculty_master(`Faculty_Code`, `Faculty_Name`, `Married`, `DOB`, `Nationality`, `Faculty_Type`, `Office_Tel`, `Res_Tel`, `Mobile`, `EMail`, `Present_Address`, `Present_City`, `Present_State`, `Present_Country`, `Present_Pin`, `Present_Tel`, `Permanent_Address`, `Permanent_City`, `Permanent_State`, `Permanent_Country`, `Permanent_Pin`, `Permanent_Tel`, `Service_Offered`, `Specialization`,`Experience`,`Company_Name`,`Company_Address`,`Company_Phone`,`Interview_Date`,`Working_At`,`Qualified`,`Joining_Date`,`Comments`,`Interviewer`,`Sal_Struct`,`Salary`,`Date_added`,`TDS`,`PAN`,`Resigned`,`InvoiceName`,`CourseId`,`DesignExp`,`KnowSw`,`Working_Status`,`TrainingCategory`,`Interview_Status`,`Reference_by`) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

            const insertParams = [
                newFacultyCode, Faculty_Name, Married, DOB, Nationality, Faculty_Type, Office_Tel, Res_Tel, Mobile, EMail, Present_Address, Present_City, Present_State, Present_Country, Present_Pin, Present_Tel, Permanent_Address, Permanent_City, Permanent_State, Permanent_Country, Permanent_Pin, Permanent_Tel, Service_Offered, Specialization, Experience, Company_Name, Company_Address, Company_Phone, Interview_Date, Working_At, Qualified, Joining_Date, Comments, Interviewer, Sal_Struct, Salary, Date_added, TDS, PAN, Resigned, InvoiceName, CourseId, DesignExp, KnowSw, Working_Status, TrainingCategory, Interview_Status, Reference_by,
            ];
            con.query(insertSql, insertParams, (err, data) => {
                if (err) return res.json(err);
                return res.json({ message: "Faculty added", Faculty_Code: newFacultyCode, result: data, Faculty_Id: data.insertId });
            });
        });
    }
    else {
        const sql =
            "update `faculty_master` set `Faculty_Code` =? , `Faculty_Name` =? , `Married` =? , `DOB` =? , `Nationality` =? , `Faculty_Type` =? , `Office_Tel` =? , `Res_Tel` =? , `Mobile` =? , `EMail` =? , `Present_Address` =? , `Present_City` =? , `Present_State` =? , `Present_Country` =? , `Present_Pin` =? , `Present_Tel` =? , `Permanent_Address` =? , `Permanent_City` =? , `Permanent_State` =? , `Permanent_Country` =? , `Permanent_Pin` =? , `Permanent_Tel` =? , `Service_Offered` =? , `Specialization` =? ,`Experience` =? ,`Company_Name` =? ,`Company_Address` =? ,`Company_Phone` =? ,`Interview_Date` =? ,`Working_At` =? ,`Qualified` =? ,`Joining_Date` =? ,`Comments` =? ,`Interviewer` =? ,`Sal_Struct` =? ,`Salary` =? ,`Date_added` =? ,`TDS` =? ,`PAN` =? ,`Resigned` =? ,`InvoiceName` =? ,`IsActive` =? ,`IsDelete` =? ,`CourseId` =? ,`DesignExp` =? ,`KnowSw` =? ,`Working_Status` =? ,`TrainingCategory` =? ,`Interview_Status` =? ,`Reference_by` =? WHERE Faculty_Id = ?";

        const param = [
            Faculty_Code, Faculty_Name, Married, DOB, Nationality, Faculty_Type, Office_Tel, Res_Tel, Mobile, EMail, Present_Address, Present_City, Present_State, Present_Country, Present_Pin, Present_Tel, Permanent_Address, Permanent_City, Permanent_State, Permanent_Country, Permanent_Pin, Permanent_Tel, Service_Offered, Specialization, Experience, Company_Name, Company_Address, Company_Phone, Interview_Date, Working_At, Qualified, Joining_Date, Comments, Interviewer, Sal_Struct, Salary, Date_added, TDS, PAN, Resigned, InvoiceName, IsActive, IsDelete, CourseId, DesignExp, KnowSw, Working_Status, TrainingCategory, Interview_Status, Reference_by, uid,
        ];

        con.query(sql, param, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    }
});

app.post("/nodeapp/update_faculty_profile", (req, res) => {
    let {
        Faculty_Name,
        Faculty_Code,
        DOB,
        Nationality,
        InvoiceName,
        Married,
        Joining_Date,
        Faculty_Type,
        KnowSw,
        TrainingCategory,
        Present_Address,
        Present_City,
        Present_Pin,
        Present_State,
        Present_Country,
        Mobile,
        EMail,
        Permanent_Address,
        Permanent_City,
        Permanent_Pin,
        Permanent_State,
        Permanent_Country,
        status, // coming from React <select>
        uid,
    } = req.body;

    let IsActive = parseInt(req.body.IsActive);
    // Simple and correct now


    if (!uid) {
        return res.status(400).json({ message: "Faculty_ID is required" });
    }

    const sql = `
        UPDATE faculty_master SET 
            Faculty_Name = ?, 
            Faculty_Code = ?, 
            DOB = ?, 
            Nationality = ?, 
            IsActive = ?, 
            InvoiceName = ?, 
            Married = ?, 
            Joining_Date = ?, 
            Faculty_Type = ?, 
            KnowSw = ?, 
            TrainingCategory = ?, 
            Present_Address = ?, 
            Present_City = ?, 
            Present_Pin = ?, 
            Present_State = ?, 
            Present_Country = ?, 
            Mobile = ?, 
            EMail = ?, 
            Permanent_Address = ?, 
            Permanent_City = ?, 
            Permanent_Pin = ?, 
            Permanent_State = ?, 
            Permanent_Country = ? 
        WHERE Faculty_Id = ?
    `;

    const param = [
        Faculty_Name,
        Faculty_Code,
        DOB,
        Nationality,
        IsActive, // derived from status
        InvoiceName,
        Married,
        Joining_Date,
        Faculty_Type,
        KnowSw,
        TrainingCategory,
        Present_Address,
        Present_City,
        Present_Pin,
        Present_State,
        Present_Country,
        Mobile,
        EMail,
        Permanent_Address,
        Permanent_City,
        Permanent_Pin,
        Permanent_State,
        Permanent_Country,
        uid

    ];

    con.query(sql, param, (err, result) => {
        if (err) {
            console.error("Error updating faculty_master:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Faculty not found" });
        }

        res.status(200).json({ message: "Faculty updated successfully" });
    });
});




app.post("/nodeapp/current_experience", (req, res) => {
    let {
        Experience,
        Company_Name,
        Specialization,
        Company_Address,
        Company_Phone,
        Service_Offered,
        Interview_Date,
        Reference_by,
        DesignExp,
        Working_Status,
        TDS,
        PAN,
        Comments,
        Joining_Date,
        Qualified,
        Sal_Struct,
        Salary,
        Interviewer,
        Interview_Status,
        uid,

    } = req.body;

    if (!uid) {
        return res.status(400).json({ message: "Faculty_ID is required" });
    }

    const sql = "update `faculty_master` set `Service_Offered` =? , `Specialization` =? ,`Experience` =? ,`Company_Name` =? ,`Company_Address` =? ,`Company_Phone` =? ,`Interview_Date` =?, `Qualified` =? ,`Joining_Date` =? ,`Comments` =? ,`Interviewer` =? ,`Sal_Struct` =? ,`Salary` =? ,`TDS` =? ,`PAN` =? ,`Working_Status` =? ,`Interview_Status` =? ,`Reference_by` =? WHERE Faculty_Id = ?";

    const params = [
        Service_Offered, Specialization, Experience, Company_Name, Company_Address, Company_Phone, Interview_Date, Qualified, Joining_Date, Comments, Interviewer, Sal_Struct, Salary, TDS, PAN, Working_Status, Interview_Status, Reference_by, uid,
    ];


    con.query(sql, params, (err, result) => {
        if (err) {
            console.error("Error updating faculty_master:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Faculty not found" });
        }

        res.status(200).json({ message: "Faculty updated successfully" });
    });

});


// app.post("/nodeapp/add_documents", (req,res)=>{

// });

// File upload API
// app.post("/nodeapp/add_faculty_documents", upload.single("file"), (req, res) => {
//     const doc_name = req.body.doc_name || "faculty_document";
//     const facultyId = req.body.faculty_id;

//     if (!facultyId || !req.file) {
//         return res.status(400).json({ success: false, message: "Missing faculty_id or file" });
//     }

//     const ext = path.extname(req.file.originalname);
//     const safeName = doc_name.replace(/\s+/g, "_");
//     const filename = `${safeName}${ext}`;
//     const fileType = req.file.mimetype;

//     const uploadDir = path.join(__dirname, `../uploads/faculty_document/${facultyId}`);

//     // Ensure folder exists
//     if (!fs.existsSync(uploadDir)) {
//         fs.mkdirSync(uploadDir, { recursive: true });
//     }

//     const filePath = path.join(uploadDir, filename);

//     try {
//         // Save file to disk
//         fs.writeFileSync(filePath, req.file.buffer);

//         // Insert file info into DB
//         const sql = "INSERT INTO Faculty_Document (`FacultyId`, `FileName`, `FileType`) VALUES (?, ?, ?)";
//         con.query(sql, [facultyId, filename, fileType], (err, result) => {
//             if (err) {
//                 return res.status(500).json({ success: false, error: err });
//             }
//             return res.json({
//                 success: true,
//                 message: "File uploaded and saved successfully",
//                 filename: filename,
//                 fileType: fileType,
//                 facultyId: facultyId
//             });
//         });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: "File save failed", detail: err.message });
//     }
// });

app.post("/nodeapp/add_faculty_documents", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const facultyId = req.body.faculty_id;
    const doc_name = req.body.doc_name || "document";
    const fileType = req.body.fileType || doc_name;
    const ext = path.extname(req.file.originalname);
    const safeName = doc_name.replace(/\s+/g, "_");
    const filename = `${safeName}${ext}`;
    const uploadDir = path.join(__dirname, `../uploads/faculty_document/${facultyId}`);

    // Create upload folder if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);

    try {
        // Save the file
        fs.writeFileSync(filePath, req.file.buffer);

        // Check if a record already exists
        const checkSql = "SELECT * FROM Faculty_Document WHERE FacultyId = ? AND FileType = ?";
        con.query(checkSql, [facultyId, fileType], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, error: err });
            }

            if (result.length > 0) {
                // Record exists → UPDATE
                const updateSql = "UPDATE Faculty_Document SET FileName = ? WHERE FacultyId = ? AND FileType = ?";
                con.query(updateSql, [filename, facultyId, fileType], (err, data) => {
                    if (err) {
                        return res.status(500).json({ success: false, error: err });
                    }
                    return res.json({ success: true, message: "File updated successfully", filename });
                });
            } else {
                // Record does not exist → INSERT
                const insertSql = "INSERT INTO Faculty_Document (`FacultyId`, `FileName`, `FileType`) VALUES (?, ?, ?)";
                con.query(insertSql, [facultyId, filename, fileType], (err, data) => {
                    if (err) {
                        return res.status(500).json({ success: false, error: err });
                    }
                    return res.json({ success: true, message: "File inserted successfully", filename });
                });
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: "File save failed", detail: err.message });
    }
});

// Backend API to get documents
app.post("/nodeapp/get_faculty_documents", (req, res) => {
    const facultyId = req.body.facultyid;

    const sql = "SELECT FileName, FileType FROM Faculty_Document WHERE FacultyId = ?";
    con.query(sql, [facultyId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err });
        }

        // Assuming files are stored in /uploads/faculty_document/{facultyId}/filename
        const docs = result.map(doc => ({
            type: doc.FileType,
            url: `/faculty_document/${facultyId}/${doc.FileName}`,
            filename: doc.FileName
        }));

        return res.json({ success: true, documents: docs });
    });
});








app.post("/nodeapp/add_annual", (req, res) => {
    let {
        selectcourse,
        batchcategory,
        description,
        trainingdate,
        actualdate,
        timings,
        basicinr,
        servicetaxI,
        coursename,
        batchcode,
        planned,
        admissiondate,
        duration,
        coordinator,
        taxrate,
        totalinr,
        servicetax,
        publish,
        uid,
    } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        const checkcourse = "select * from Batch_Mst where Course_Id = ?";

        con.query(checkcourse, [selectcourse], (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                const count = data.length;

                const code = selectcourse + "0" + count;

                sql =
                    "insert into Batch_Mst(`Course_Id`,`Category`,`Course_description`,`EDate`,`ActualDate`,`Timings`,`INR_Basic`,`INR_ServiceTax`,`CourseName`,`Batch_code`,`SDate`,`Admission_Date`,`Duration`,`Training_Coordinator`,`TaxRate`,`INR_Total`,`Dollar_ServiceTax`,`Corporate`) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

                param = [
                    selectcourse,
                    batchcategory,
                    description,
                    trainingdate,
                    actualdate,
                    timings,
                    basicinr,
                    servicetaxI,
                    coursename,
                    code,
                    planned,
                    admissiondate,
                    duration,
                    coordinator,
                    taxrate,
                    totalinr,
                    servicetax,
                    publish,
                ];

                con.query(sql, param, (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        return res.json(data);
                    }
                });
            }
        });
    } else {
        sql =
            "update `Batch_Mst` set `Course_Id` = ? , `Category` =? , `Course_description` = ? ,`EDate` =? ,`ActualDate` =? ,`Timings` =? ,`INR_Basic` = ? ,`INR_ServiceTax` =? ,`CourseName` =?  ,`SDate` =? ,`Admission_Date` =? ,`Duration` =?,`Training_Coordinator` = ? ,`TaxRate` =? ,`INR_Total` =? ,`Dollar_ServiceTax` = ? , `Corporate` = ?   where `Batch_Id` = ?";

        param = [
            selectcourse,
            batchcategory,
            description,
            trainingdate,
            actualdate,
            timings,
            basicinr,
            servicetaxI,
            coursename,
            planned,
            admissiondate,
            duration,
            coordinator,
            taxrate,
            totalinr,
            servicetax,
            publish,
            uid,
        ];

        con.query(sql, param, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    }
});

app.post("/nodeapp/update_batchdetails", (req, res) => {
    let {
        selectcourse,
        batchcategory,
        description,
        trainingdate,
        actualdate,
        timings,
        basicinr,
        servicetaxI,
        coursename,
        batchcode,
        planned,
        admissiondate,
        duration,
        coordinator,
        taxrate,
        totalinr,
        servicetax,
        category,
        uid,
    } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into Batch_Mst(`Course_Id`, `Batch_Category_id`,`Category`,`Course_description`,`EDate`,`ActualDate`,`Timings`,`INR_Basic`,`INR_ServiceTax`,`CourseName`,`Batch_code`,`SDate`,`Admission_Date`,`Duration`,`Training_Coordinator`,`TaxRate`,`INR_Total`,`Dollar_ServiceTax`) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            selectcourse,
            batchcategory,
            category,
            description,
            trainingdate,
            actualdate,
            timings,
            basicinr,
            servicetaxI,
            coursename,
            batchcode,
            planned,
            admissiondate,
            duration,
            coordinator,
            taxrate,
            totalinr,
            servicetax,
        ];
    } else {
        sql =
            "update `Batch_Mst`  set Course_Id = ? ,Batch_Category_id = ?,Category =? ,Course_description = ? ,EDate = ? ,ActualDate = ?,Timings = ? ,INR_Basic = ? ,INR_ServiceTax = ? ,CourseName = ? ,SDate = ? ,Admission_Date = ? ,Duration = ? ,Training_Coordinator = ? ,TaxRate = ?,INR_Total = ? , Dollar_ServiceTax =? where Batch_Id = ?";

        param = [
            selectcourse,
            batchcategory,
            category,
            description,
            trainingdate,
            actualdate,
            timings,
            basicinr,
            servicetaxI,
            coursename,
            planned,
            admissiondate,
            duration,
            coordinator,
            taxrate,
            totalinr,
            servicetax,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            // return res.json(data)

            const batch_id = data.insertId;

            if (uid == undefined) {
                const insertsql =
                    "insert into batch_result_structure(`batch_id`,`unit_test`,`assignment_wt`,`exam_wt`) values(?,?,?,?)";

                con.query(insertsql, [batch_id, 35, 15, 50], (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        return res.json(data);
                    }
                });
            } else {
                return res.json(data);
            }
        }
    });
});

app.post("/nodeapp/update_batch", (req, res) => {
    let {
        selectcourse,
        batchcategory,
        timings,
        coursename,
        planned,
        admissiondate,
        duration,
        coordinator,
        eligibility,
        targetstudent,
        passingcriteria,
        comments,
        briefdescription,
        attachment,
        documentrequire,
        todate,
        batchcategoryid,
        uid,
    } = req.body;
    let sql;
    let param;
    sql =
        "update `Batch_Mst` set Course_Id = ? , Category =? , Timings = ? , CourseName = ? ,SDate = ? ,Admission_Date = ?,Duration = ? ,Training_Coordinator = ? ,Min_Qualifiaction = ? ,Max_Students = ? , Passing_Criteria = ? , Comments = ? ,Course_description = ? ,Attachment = ? ,Documents_Required = ? ,EDate = ?,Batch_Category_id = ?   where `Batch_Id` = ?";
    param = [
        selectcourse,
        batchcategory,
        timings,
        coursename,
        planned,
        admissiondate,
        duration,
        coordinator,
        eligibility,
        targetstudent,
        passingcriteria,
        comments,
        briefdescription,
        attachment,
        documentrequire,
        todate,
        batchcategoryid,
        uid,
    ];
    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            if (coursename) {
                sql = "update `Course_Mst` set Course_Name = ? where Course_Id = ?";
                param = [coursename, selectcourse];
                con.query(sql, param, (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        return res.json(data);
                    }
                });
            } else {
                return res.json(data);
            }
        }
    });
});

app.post("/nodeapp/add_bookissue", (req, res) => {
    let { student, book, bookcode, issuedate, returndate, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into awt_bookissue(`student`,`book`,`bookcode`,`issuedate`,`returndate`) values(?,?,?,?,?)";

        param = [student, book, bookcode, issuedate, returndate];
    } else {
        sql =
            "update `awt_bookissue` set `student` =? , `book` =? , `bookcode` =? ,`issuedate` =? ,`returndate` =? where id = ?";

        param = [student, book, bookcode, issuedate, returndate, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_employeerecord", (req, res) => {
    let { training, attendee, instructor, description, feedback, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql =
            "insert into awt_employeerecord(`training`,`attendee`,`instructor`,`description`,`feedback`) values(?,?,?,?,?)";

        param = [training, attendee, instructor, description, feedback];
    } else {
        sql =
            "update `awt_employeerecord` set `training` =? , `attendee` =? , `instructor` =? ,`description` =? , `feedback` =? where id = ?";

        param = [training, attendee, instructor, description, feedback, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json({ error: err.message });
        } else {
            if (uid === undefined || uid === null || uid === "") {
                return res.json("Data Inserted");
            } else {
                return res.json("Data Updated");
            }
        }
    });
});

app.post("/nodeapp/getadmissionactivity", (req, res, next) => {
    const { page = 0, pageSize = 10 } = req.body;

    const offset = page * pageSize;

    const sql =
        `SELECT 
    i.Inquiry_Id AS id,
    COALESCE(i.Student_Id, sm.Student_Id) AS Student_Id,
    COALESCE(i.FName, sm.FName) AS FName,
    COALESCE(i.LName, sm.LName) AS LName,
    COALESCE(i.MName, sm.MName) AS MName,
    COALESCE(i.Student_Name, sm.Student_Name) AS Student_Name,
    COALESCE(i.Course_Id, sm.Course_Id) AS Course_Id,
    COALESCE(i.Qualification, sm.Qualification) AS Qualification,
    COALESCE(i.present_mobile, sm.present_mobile) AS present_mobile,
    COALESCE(i.Email, sm.Email) AS Email,
    COALESCE(i.Discipline, sm.Discipline) AS Discipline,
    COALESCE(i.Inquiry_type, sm.Inquiry_type) AS Inquiry_type,
    COALESCE(i.isActive, sm.isActive) AS isActive,
    COALESCE(i.inquiry_DT, sm.inquiry_DT) AS inquiry_DT,
    c.Course_Name,
    COALESCE(i.Percentage, sm.Percentage) AS Percentage,
    COALESCE(i.Discussion, sm.Discussion) AS Discussion,
    sm_status.Status,
    md.Deciplin,
    COALESCE(i.IsUnread, sm.IsUnread) AS IsUnread
FROM Student_Inquiry AS i
LEFT JOIN Student_Master AS sm ON i.Student_Id = sm.Student_Id
LEFT JOIN Course_Mst AS c ON COALESCE(i.Course_id, sm.Course_Id) = c.Course_Id
LEFT JOIN Status_Master AS sm_status ON sm_status.Id = COALESCE(i.OnlineState, sm.OnlineState)
LEFT JOIN MST_Deciplin AS md ON md.Id = COALESCE(i.Discipline, sm.Discipline)
WHERE COALESCE(i.isDelete, sm.isDelete) = 0 
  AND COALESCE(i.Admission, sm.Admission) != 1
ORDER BY COALESCE(i.Inquiry_Dt, sm.Inquiry_Dt) DESC
LIMIT ? OFFSET ?;`;

    const countQuery = `
  SELECT COUNT(*) as totalCount 
  FROM Student_Inquiry as i where i.isDelete = 0 and i.Admission != 1 `;

    con.query(sql, [pageSize, offset], (error, data) => {
        if (error) {
            return res.json(error);
        }

        con.query(countQuery, (err, countResult) => {
            if (err) {
                return res.json({ error: err.message });
            }

            const totalCount = countResult[0]?.totalCount || 0; // Get total count from the count query

            // Determine the last student ID
            let lastStudentId = null;
            if (data.length > 0) {
                lastStudentId = data[data.length - 1].id;
            }

            // Respond with paginated data and total count
            return res.json({ data, totalCount, lastStudentId });
        });
    });
});

app.post("/nodeapp/getBtachwiseamount", (req, res, next) => {
    const Batch_Code = req.body.Batch_Code;

    const sql =
        "SELECT bm.Batch_Id,bm.Batch_code,fs.total_inr FROM `Batch_Mst` as bm LEFT JOIN Fees_Structure as fs  on bm.Batch_Id = fs.batch_id WHERE bm.Batch_code =  ? and isDelete = 0 ";

    con.query(sql, [Batch_Code], (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getadmissiondata", (req, res, next) => {
    //   const sql = 'SELECT i.Inquiry_Id as id,i.Student_Id,i.FName, i.LName, i.MName,i.Student_Name,i.Course_Id,i.Qualification, i.Discussion, i.present_mobile, i.Email, i.Discipline, i.Inquiry_type, i.isActive, i.inquiry_DT, c.Course_Name, i.Percentage , sm.Status , md.Deciplin , i.IsUnread FROM Student_Inquiry AS i LEFT JOIN Course_Mst AS c ON i.Course_id = c.Course_Id LEFT JOIN Status_Master as sm on sm.Id = i.OnlineState left JOIN MST_Deciplin as md on md.Id = i.Discipline WHERE i.isDelete = 0 order by i.Inquiry_Id desc';
    const sql =
        "select sm.*, cm.Course_Name from Student_Master as sm left join Course_Mst as cm on cm.Course_Id = sm.Course_Id where sm.IsDelete = 0 order by sm.Student_Id desc";
    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/admissiondata", (req, res, next) => {
    const sql =
        "select am.Admission_Id,am.Admission_Date,am.Amount ,am.Payment_Type, sm.Student_Name ,cm.Course_Name,bm.Batch_code from Admission_master as am left join Student_Master as sm on sm.Student_Id = am.Student_Id left JOIN Course_Mst as cm on cm.Course_Id = am.Course_Id LEFT JOIN Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where am.isDelete = 0 and sm.IsAdmOpen = 'open' order by am.Admission_Id desc";
    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});

// app.post('/nodeapp/process_admission', (req, res, next) => {

//   let { Student_Id, Course_Id, Batch_Id, Amount, Admission_Dt, student_code } = req.body

//   const sql = 'insert into Admission_master(`Student_Id`,`Course_Id`,`Batch_Id`,`Amount`,`Admission_Date`,`Student_Code`,`Payment_Type`) values(?,?,?,?,?,?,?)'

//   con.query(sql, [Student_Id, Course_Id, Batch_Id, Amount, Admission_Dt, student_code,'Lumpsum'], (error, data) => {

//     if (error) {
//       return res.json(error);
//     } else {
//       const updatestudent = 'update Student_Master set Admission = 1 , Status_id = 8  where Student_Id = ?'

//       con.query(updatestudent, [Student_Id], (err, data) => {
//         if (err) {
//           return res.json(err)
//         } else {

//           const sql = "update Student_Inquiry set Admission = 1 where Student_Id = ?"
//           con.query(sql, [Student_Id], (err, data) => {
//             if (err) {
//               return res.json(err)
//             } else {
//               return res.json()
//             }
//           })
//         }
//       })
//     }
//   })

// })

app.post("/nodeapp/process_admission", async (req, res) => {
    const { Student_Id, Course_Id, Batch_Id, Amount, Admission_Dt, student_code } = req.body;

    const sqlInsert = `
    INSERT INTO Admission_master
    (Student_Id, Course_Id, Batch_Id, Amount, Admission_Date, Student_Code, Payment_Type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
    const sqlUpdateStudent = `
    UPDATE Student_Master 
    SET Admission = 1, Status_id = 8 
    WHERE Student_Id = ?
  `;
    const sqlUpdateInquiry = `
    UPDATE Student_Inquiry 
    SET Admission = 1 
    WHERE Student_Id = ?
  `;

    const updateinfees = `insert into S_Fees_Mst (Student_Id,Course_Id,Batch_Id,Amount,Total_Amt,TypeR,IsDelete,Date_Added) values(?,?,?,?,?,?,0,?)`;

    try {
        // Insert into Admission_master
        await query(con, sqlInsert, [Student_Id, Course_Id, Batch_Id, Amount, Admission_Dt, student_code, "Lumpsum"]);

        // Update Student_Master
        await query(con, sqlUpdateStudent, [Student_Id]);

        // Update Student_Inquiry
        await query(con, sqlUpdateInquiry, [Student_Id]);

        //insert into fees master
        await query(con, updateinfees, [Student_Id, Course_Id, Batch_Id, Amount, Amount, 'D', Admission_Dt]);

        const sqlStudentDetails = `select sm.Student_Name, cm.Course_Name, sm.Email from Student_Master as sm 
    left join Course_Mst as cm ON sm.Course_Id = cm.Course_Id where sm.Student_Id = ? and sm.IsDelete = 0`;

        const [data] = await query(con, sqlStudentDetails, [Student_Id]);
        const { Student_Name, Course_Name, Email } = data;

        const htmlBody = `
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
                <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
                <title>Document</title>
                <style>
                    body{
                        font-family: "Roboto", sans-serif;
                    }
                    p {
                        color: #335F9B;
                    }
                    .font600 {
                        font-weight: 600;
                    }
                    .m-0{
                        margin: 0px;
                    }
                    .color-light{
                        color: #4F81BD;
                    }
                    .last p{
                        font-size: 10px;
                    }
                </style>
            </head>
            <body>
                <p>Dear <b>${Student_Name},</b></p>
                <p>Warm greetings from SIT!!!</p>
                <p><b>Your admission form is accepted for ${Course_Name}.</b></p>
                <p>Please find the attach documents, request you to kindly read the same and send us the signed copy of it.</p>
                <p>Kindly make the payment as earliest to confirm your admission</p>
                <p><b>You can do the payment through NEFT; RTGS or you can directly deposit the cheque in our axis bank account</b></p>
                <p style="text-decoration: underline;">Please find below bank details of SIT :</p>
                <div style="display: flex;">
                    <p>Bank account name</p>
                    <p style="padding-left: 50px;">: Suvidya Institute of Technology Pvt. Ltd.</p>
                </div>
                <div style="display: flex;">
                    <p>Bank Name</p>
                    <p style="padding-left: 99px;">: Axis Bank Ltd.</p>
                </div>
                <div style="display: flex;">
                    <p>Branch Address</p>
                    <p style="padding-left: 74px;">: Vakola, Mumbai (MH), City Survey No. 841 to 846,<br>Florence Lorenace chs ltd. Mumbai 400055.</p>
                </div>
                <div style="display: flex;">
                    <p>Bank Account No</p>
                    <p style="padding-left: 62px;">: 911020002988600</p>
                </div>
                <div style="display: flex;">
                    <p>IFSC code for NEFT payment </p>
                    <p style="padding-left: 50px;">: UTIB0001244</p>
                </div>
                <div style="display: flex;">
                    <p>MICR Code</p>
                    <p style="padding-left: 100px;">: 400211082</p>
                </div>
                <div style="display: flex;">
                    <p>Swift Code</p>
                    <p style="padding-left: 106px;">: AXISINBB028</p>
                </div>

                <p>Mention your Reference no. (mentioned in subject of this mail)  in all correspondence.</p>

                <p><b>Please find attached herewith Procedure & Rules & Regulation for your information.</b></p>
                <p><b>Please mail us payment slip/bank payment advice after payment.  For any queries related to accounts, call on 022-61943120 or mail on</b><a  href="mailto:manasipanchal@suvidya.ac.in" style="text-decoration: underline;"> manasipanchal@suvidya.ac.in</a></p>

                <p class="m-0 font600 color-light">Regards,</p>
                <p class="m-0 font600 color-light">Vaidehi Patankar</p>
                <p class="m-0 font600 color-light">Sr. Executive Career Building Department</p>
                <p class="m-0 font600 color-light">Mobile No: 9167219405</p>
                <p class="m-0 font600 color-light">Tel: 91 022 26682295, 91 022 26682290 - Ext.101</p>

                <div>
                    <p><a href="mailto:www.suvidya.ac.in ">www.suvidya.ac.in  </a>  |  <a href="mailto:www.accent.net.in">www.accent.net.in</a></p>

                    <p class=" font600 color-light">Follow Simple Rules – Change Food to Improve Immunity, Use Mask, Keep Safe Distance, use Sanitiser, Be Happy and Be Healthy.</p>
                    <p class=" font600 color-light">Print if it is very much necessary to support environment as one Kg paper need 10 litres of water.</p>
                    <p class=" font600 color-light">Disclaimer – Email contents are for your information only, if you do not wish to received then please feel free  to infrom us happily, will stop sending with immediate effect.</p>

                    <img style="width: 100px;" src="https://ci3.googleusercontent.com/meips/ADKq_NbsTBI0TbxWtHsgK4sZiEjQKNTdIHzy9jy8nKKE_9hmO0Wf6ofXFypOTD-0REzIfxiG23CcpvDEBSdVzxc-wEUDQ3IRel8=s0-d-e1-ft#http://sit.suvidya.ac.in/images/suvidya_logo.jpg" alt="">

                    <p style="font-size: 13px;"><b>Suvidya Institute of Technology Pvt. Ltd.</b></p>
                    <p style="font-size: 13px;"><b>An ISO 9001:2015 Certified Organisation by Bureau of Indian Standards</b></p>
                    <p style="font-size: 13px;margin-top: 30px;"><b>18/140,  Anand Nagar, Nehru Road, Vakola,</b></p>
                    <p style="font-size: 13px;"><b>Santacruz (East), Mumbai – 400 055.</b></p>

                    <div style="margin: 20px 0px;" class="last">
                        <p>Tel: 91 022 26682290 Ext.11, 16. Cell:9821569885</p>
                        <p>Email {Senderemail}</p>
                        <p>Website : <a href="https://www.suvidya.ac.in" target="_blank">www.suvidya.ac.in</a></p>
                    </div>
                    <p style="font-family: 'Satisfy', cursive;"><b>“Together we will bring new dimension to engineering industry”</b></p>
                </div>
            </body>
        </html>
    `;
        const confirmationHtmlBody = `
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
                <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
                <title>Document</title>
                <style>
                    body{
                        font-family: "Roboto", sans-serif;
                    }
                    p {
                        color: #335F9B;
                    }
                    .font600 {
                    font-weight: 600;
                    }
                    .m-0{
                        margin: 0px;
                    }
                    .color-light{
                    color: #4F81BD;
                    }
                    .last p{
                        font-size: 10px;
                    }
                </style>
            </head>

            <body>
                <p>Dear Vaidehi Patankar,</p>

                <p>This is to confirm that the admission form acceptance mail has been successfully sent to the following student:</p>

                <p>Student Name: ${Student_Name}</p>
                <p>Email: ${Email}</p>
                <p>Course: ${Course_Name}</p>
                
                <p>Best regards,</p>
                <p>Suvidya Institute of Technology Pvt. Ltd.</p>
            </body>
        </html>
    `;

        const client = new SendMailClient({ url, token });
        await client.sendMail({
            from: {
                address: "noreply@sitsuvidya.in",
                name: "noreply",
            },
            to: [
                {
                    email_address: {
                        address: Email,
                        name: Student_Name,
                    },
                },
            ],
            // cc: [ { email_address: { address: "vaidehipatankar@suvidya.ac.in", name: "Jeena Fernandes" } } ],
            subject: "Admission Form Accepted",
            htmlbody: htmlBody,
        });

        await client.sendMail({
            from: {
                address: "noreply@sitsuvidya.in",
                name: "noreply",
            },
            to: [
                {
                    email_address: {
                        address: "vaidehipatankar@suvidya.ac.in",
                        name: "Vaidehi Patankar",
                    },
                },
            ],
            subject: `Confirmation: Admission Form Acceptance Mail Sent to ${Student_Name}`,
            htmlbody: confirmationHtmlBody,
        });

        res.json({ message: "Admission process completed successfully." });
    } catch (error) {
        console.error("Error during admission process:", error);
        res.status(500).json({ message: "An error occurred during the admission process.", error: error.message });
    }
});

// Helper function to wrap query into a Promise
const query = (connection, sql, params) => {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
};

app.post("/nodeapp/studentDetail", (req, res, next) => {
    const { id } = req.body;

    const sql = `SELECT 
    i.Inquiry_Id AS id,
    COALESCE(i.Student_Id, sm.Student_Id) AS Student_Id,
    COALESCE(i.Sex, sm.Sex) AS Sex,
    COALESCE(i.DOB, sm.DOB) AS DOB,
    COALESCE(i.Student_Name, sm.Student_Name) AS Student_Name,
    COALESCE(i.Course_Id, sm.Course_Id) AS Course_Id,
    COALESCE(i.Qualification, sm.Qualification) AS Qualification,
    COALESCE(i.Discussion, sm.Discussion) AS Discussion,
    COALESCE(i.Present_Mobile, sm.Present_Mobile) AS Present_Mobile,
    COALESCE(i.Nationality, sm.Nationality) AS Nationality,
    COALESCE(i.Email, sm.Email) AS Email,
    COALESCE(i.Discipline, sm.Discipline) AS Discipline,
    COALESCE(i.Inquiry_type, sm.Inquiry_type) AS Inquiry_type,
    COALESCE(i.isActive, sm.isActive) AS isActive,
    COALESCE(i.inquiry_DT, sm.inquiry_DT) AS inquiry_DT,
    COALESCE(i.Percentage, sm.Percentage) AS Percentage,
    c.Course_Name,
    COALESCE(i.Present_Country, sm.Present_Country) AS Present_Country,
    COALESCE(i.StateChangeDt, sm.StateChangeDt) AS StateChangeDt,
    COALESCE(i.OnlineState, sm.OnlineState) AS OnlineState,
    COALESCE(i.Inquiry, sm.Inquiry) AS Inquiry,
    COALESCE(i.Batch_Category_id, sm.Batch_Category_id) AS Batch_Category_id,
    COALESCE(i.Refered_By, sm.Refered_By) AS Refered_By,
    COALESCE(i.Batch_Code, sm.Batch_Code) AS Batch_Code
FROM Student_Inquiry AS i
LEFT JOIN Student_Master AS sm ON i.Student_Id = sm.Student_Id
LEFT JOIN Course_Mst AS c ON COALESCE(i.Course_Id, sm.Course_Id) = c.Course_Id
WHERE i.Inquiry_Id = ?`;


    con.query(sql, [id], (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        }

        return res.json(data);
    });
});

app.post("/nodeapp/AdmitDetail", (req, res, next) => {
    const { id } = req.body;

    const sql =
        "select am.Admission_Id,am.Student_Code,am.Course_Id, am.Batch_Id,am.Admission_Date ,am.Payment_Type,am.Amount, sm.Student_Name ,sm.Student_Id from Admission_master as am left join Student_Master as sm on sm.Student_Id = am.Student_Id left JOIN Course_Mst as cm on cm.Course_Id = am.Course_Id LEFT JOIN Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where am.Admission_Id = ?";

    con.query(sql, [id], (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        }

        return res.json(data);
    });
});
app.get("/nodeapp/getEducation", (req, res, next) => {
    const sql = "SELECT * FROM MST_Education";

    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});
app.get("/nodeapp/getDiscipline", (req, res, next) => {
    const sql = "SELECT * FROM MST_Deciplin where IsDelete = 0";

    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});
app.get("/nodeapp/getEmployee", (req, res, next) => {
    const sql = "SELECT Emp_Id,Employee_Name FROM Office_Employee_Mst where IsDelete = 0 ORDER BY Employee_Name ASC";

    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getCourses", (req, res, next) => {
    const sql = "SELECT Course_Id, Course_Name FROM Course_Mst ";

    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getCollege", (req, res, next) => {
    const sql = "SELECT * FROM awt_college where deleted = 0";

    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getCollegedropdown", (req, res, next) => {
    const sql = "SELECT id,college_name FROM awt_college where deleted = 0";

    con.query(sql, (error, data) => {
        if (error) {
            return res.json(error);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/postInquiry", (req, res, next) => {
    const {
        Enquiry_Id,
        firstname,
        email,
        gender,
        dob,
        mobile,
        InquiryDate,
        modeEnquiry,
        advert,
        programmeEnquired,
        selectedProgramme,
        category,
        batch,
        qualification,
        descipline,
        percentage,
        nationality,
        statusdate,
        status,
        country,
        discussion,
    } = req.body;

    const created_date = new Date();

    const insertIntoInquiry =
        "INSERT INTO Student_Inquiry ( Email, Student_Name, Sex, DOB, Present_Mobile,Inquiry_Dt, Inquiry_type, Qualification, Discipline, Percentage, Course_Id ,Nationality,Present_Country,Discussion,StateChangeDt,OnlineState ,Inquiry,Batch_Category_id ,Batch_Code ,Refered_By , IsUnread ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    con.query(
        insertIntoInquiry,
        [
            email,
            firstname,
            gender,
            dob,
            mobile,
            InquiryDate,
            modeEnquiry,
            qualification,
            descipline,
            percentage,
            selectedProgramme,
            nationality,
            country,
            discussion,
            statusdate,
            status,
            programmeEnquired,
            category,
            batch,
            advert,
            '1'
        ],
        (error, data) => {
            if (error) {
                res.json(error);
                return;
            } else {
                const inquiryid = data.insertId;


                if (Enquiry_Id == ':inquiryid') {

                    const adddiscussion = "insert into awt_inquirydiscussion(`Inquiry_id`,`date`,`discussion`,`created_date`) values(?,?,?,?)";

                    con.query(adddiscussion, [inquiryid, InquiryDate, discussion, created_date], (err, data) => {
                        if (err) {
                            return res.json(err);
                        } else {
                            return res.json({ message: "Data added to inquiry table.", inquiryid: inquiryid })
                        }
                    });

                } else {
                    return res.json({ message: "Data added to inquiry table.", inquiryid: inquiryid })

                }



                // res.status(200).json({ message: "Data added to inquiry table." });
            }
        }
    );
});

// app.post("/nodeapp/SendInquiry", (req, res, next) => {
//     const { firstname, email, mobile, qualification, location, course } = req.body;

//     // Mobile number validation: must be exactly 10 digits
//     const mobileRegex = /^[0-9]{10}$/;
//     if (!mobileRegex.test(mobile)) {
//         return res.status(400).json({ error: "Invalid mobile number. It must be exactly 10 digits." });
//     }

//     const date = new Date();
//     const formattedDate = date.toISOString().slice(0, 10);



//     const insertIntoInquiry =
//         "INSERT INTO Student_Inquiry ( Email, Student_Name, Present_Mobile, Qualification, Course_Id ,Present_City ,Inquiry_Dt) VALUES (?,?,?,?,?,?,?)";

//     con.query(insertIntoInquiry,[email, firstname, mobile, qualification, course, location, formattedDate],(error, data) => {
//             if (error) {
//                 res.json(error);
//                 return;
//             }

//                            const htmlbody = `
//        <html lang="en">

//     <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <link rel="preconnect" href="https://fonts.googleapis.com">
//     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
//     <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
//     <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
//         <title>Document</title>
//         <style>
//             body{
//                 font-family: "Roboto", sans-serif;
//             }
//             p {
//                 color: #335F9B;
//             }
//             .font600 {
//             font-weight: 600;
//             }
//             .m-0{
//                 margin: 0px;
//             }
//             .color-light{
//             color: #4F81BD;
//             }
//             .last p{
//                 font-size: 10px;
//             }
//         </style>
//     </head>

//     <body>
//         <p>Dear <b>${firstname},</b></p>
//         <p>Warm greetings from SIT!!!</p>
//         <p><b>Your enquiry for admission is accepted.</b></p>
//         <p>We will get back to you shortly.</p>
//         <p>For any queries please call on 022-26682290 or mail on</p> <a href="mailto:

//     </body>

//     </html>
//       `;

//                         try {
//                             const client = new SendMailClient({ url, token });


//                             await client.sendMail({
//                                 from: {
//                                     address: "noreply@sitsuvidya.in",
//                                     name: "noreply",
//                                 },
//                                 to: [
//                                     {
//                                         email_address: {
//                                             address: 'santoshmestry@suvidya.ac.in',
//                                             name: "Santosh Mestry",
//                                         },
//                                     },
//                                 ],
//                                 subject: `New Inquiry from ${firstname}`,
//                                 htmlbody: htmlbody
//                             });
//             writeLog(`this email is inserted ${mobile} and ${email}`);
//             res.status(200).json({ message: "Data added to inquiry table." });
//         }
//     );
// });

app.post("/nodeapp/SendInquiry", async (req, res) => {
    const { firstname, email, mobile, qualification, location, course } = req.body;

    // Mobile number validation: must be exactly 10 digits
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
        return res.status(400).json({ error: "Invalid mobile number. It must be exactly 10 digits." });
    }

    const date = new Date();
    const formattedDate = date.toISOString().slice(0, 10);

    const insertIntoInquiry =
        "INSERT INTO Student_Inquiry (Email, Student_Name, Present_Mobile, Qualification, Course_Id, Present_City, Inquiry_Dt) VALUES (?,?,?,?,?,?,?)";

    const getcourse = `select * from Course_Mst where Course_Id = ?`;
    const courseData = await query(con, getcourse, [course]);
    if (courseData.length === 0) {
        return res.status(400).json({ error: "Invalid course ID." });
    }
    const courseName = courseData[0].Course_Name;

    try {
        // Wrap DB insert in a Promise
        await new Promise((resolve, reject) => {
            con.query(
                insertIntoInquiry,
                [email, firstname, mobile, qualification, course, location, formattedDate],
                (error, data) => {
                    if (error) return reject(error);
                    resolve(data);
                }
            );
        });

        // Prepare email body
        const htmlbody = `
               <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: "Roboto", sans-serif; }
                .font600 { font-weight: 600; }
                .m-0 { margin: 0px; }
                .last p { font-size: 10px; }
            </style>
        </head>
        <body>
            <p>Hello Admin</p></br>
            <p>New Course enquiry received , below are the user details:</p><br/>
            <p><b>First Name:</b> ${firstname}</p>
            <p><b>Email ID:</b><a href=""> ${email}</a></p> 
            <p><b>Phone:</b><a href=""> ${mobile}</a></p> 
            <p><b>Select Course:</b> ${courseName}</p></br/>
            <p style="margin-bottom: 5px;">Regards,</p>
            <p style="margin: 0px;">Suvidya Website</p>    
        </body>
        </html>
        `;

        // Send email
        const client = new SendMailClient({ url, token });

        await client.sendMail({
            from: {
                address: "noreply@sitsuvidya.in",
                name: "noreply",
            },
            to: [
                {
                    email_address: {
                        address: "santoshmestry@suvidya.ac.in",
                        name: "Santosh Mestry",
                    },
                },
            ],
            subject: `New Inquiry from ${firstname}`,
            htmlbody: htmlbody,
        });

        writeLog(`Email sent for inquiry - Mobile: ${mobile}, Email: ${email}`);
        return res.status(200).json({ message: "Data added to inquiry table and email sent." });

    } catch (error) {
        console.error("Error in SendInquiry:", error);
        return res.status(500).json({ error: "Something went wrong", details: error.message });
    }
});


app.post("/nodeapp/updateInquiry", (req, res, next) => {
    const created_date = new Date();

    const {
        Enquiry_Id,
        firstname,
        email,
        gender,
        dob,
        mobile,
        InquiryDate,
        modeEnquiry,
        advert,
        programmeEnquired,
        selectedProgramme,
        category,
        batch,
        qualification,
        descipline,
        percentage,
        nationality,
        statusdate,
        status,
        country,
        discussion,
    } = req.body;

    const sql =
        "UPDATE Student_Inquiry SET  Student_Name = ?, Email = ?, Sex = ?, DOB = ?, Present_Mobile = ?, Inquiry_Dt = ?, Inquiry_type =?, Course_Id = ?, Qualification = ?, Discipline = ?, Percentage = ? , Discussion = ? ,StateChangeDt = ? ,OnlineState = ?, Inquiry = ?,Batch_Category_id = ? ,Batch_Code =? , Refered_By = ? ,Nationality = ?, Present_Country = ? ,IsUnread = 1 WHERE Inquiry_Id = ? ";

    con.query(
        sql,
        [
            firstname,
            email,
            gender,
            dob,
            mobile,
            InquiryDate,
            modeEnquiry,
            selectedProgramme,
            qualification,
            descipline,
            percentage,
            discussion,
            statusdate,
            status,
            programmeEnquired,
            category,
            batch,
            advert,
            nationality,
            country,
            Enquiry_Id,
        ],
        (error, data) => {
            if (error) {
                res.status(500).json(error);
                return;
            } else {
                res.status(200).json({ message: "Data added to inquiry table." });
                // const adddiscussion =
                //     "insert into awt_inquirydiscussion(`Inquiry_id`,`date`,`discussion`,`created_date`) values(?,?,?,?)";

                // con.query(adddiscussion, [Enquiry_Id, InquiryDate, discussion, created_date], (err, data) => {
                //     if (err) {
                //         return res.json(err);
                //     } else {
                //         res.status(200).json({ message: "Data added to inquiry table." });
                //     }
                // });
            }
        }
    );
});

app.post("/nodeapp/deleteInquiry", (req, res, next) => {
    const { Inquiry_Id } = req.body;

    const sql = "UPDATE Student_Inquiry SET isDelete = 1 WHERE Inquiry_Id = ?";

    con.query(sql, [Inquiry_Id], (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        }
        return res.status(200).json({
            message: "Record Deleted.",
        });
    });
});

app.get("/nodeapp/getStudents", (req, res, next) => {
    const sql =
        "SELECT sm.Student_Id,sm.Batch_Code,sm.Student_Name,sm.Present_Address,sm.Email, sm.Present_Mobile, sm.Qualification, sm.IsActive ,stm.Status ,sm.Admission_Dt FROM Student_Master as sm left join Status_Master as stm on stm.Id = sm.Status_id WHERE sm.IsDelete = 0 and sm.Admission != 1 and sm.IsAdmOpen = 'open' and sm.Status_id != 8 and sm.Admission_Dt IS NOT NULL order by sm.created_date desc";

    con.query(sql, (error, data) => {
        if (error) {
            res.status(500).json({
                message: "Cannot get Students data.",
            });
            return;
        }

        return res.status(200).json(data);
    });
});

app.get("/nodeapp/getFinalStudents", (req, res, next) => {
    const sql =
        "SELECT sm.Student_Id,sm.Batch_Code,sm.Student_Name,sm.Present_Address,sm.Email, sm.Present_Mobile, sm.Qualification, sm.IsActive ,stm.Status FROM Student_Master as sm left join Status_Master as stm on stm.Id = sm.OnlineState WHERE sm.IsDelete = 0 and Admission = 1  order by sm.Student_Id desc";

    con.query(sql, (error, data) => {
        if (error) {
            res.status(500).json({
                message: "Cannot get Students data.",
            });
            return;
        }

        return res.status(200).json(data);
    });
});

app.get("/nodeapp/getCorporate", (req, res, next) => {
    const sql =
        "SELECT co.Id, co.FullName,co.email,c.Course_Name FROM CorporateInquiry as co LEFT JOIN Course_Mst AS c ON co.Course_Id = c.Course_Id WHERE co.IsDelete = 0";

    con.query(sql, (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        }

        return res.status(200).json(data);
    });
});

app.get("/nodeapp/getBtach", (req, res, next) => {
    const sql =
        "SELECT Batch_Id, Course_Id, Batch_code, Batch_Category_id  FROM Batch_Mst WHERE isDelete = 0 AND isActive = 1";

    con.query(sql, (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        }

        return res.status(200).json(data);
    });
});

app.get("/nodeapp/getBtachCategory", (req, res, next) => {
    const sql = "SELECT BatchCategory,id  FROM MST_BatchCategory WHERE isDelete = 0 AND isActive = 1";

    con.query(sql, (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        }

        return res.status(200).json(data);
    });
});

app.post(`/nodeapp/data_status`, (req, res) => {
    let status = req.body.status;
    let Inquiry_Id = req.body.Inquiry_Id;
    let table_name = req.body.table_name;
    const sql = `update ${table_name} set isActive = ? where Inquiry_Id = ?`;

    con.query(sql, [status, Inquiry_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/data_Corporate_status`, (req, res) => {
    let status = req.body.status;
    let Inquiry_Id = req.body.Inquiry_Id;
    let table_name = req.body.table_name;

    const sql = `update ${table_name} set isActive = ? where Id = ?`;

    con.query(sql, [status, Inquiry_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/getcompanyinfo`, (req, res) => {
    let student_id = req.body.student_id;

    const sql = "select * from `Company_info` where Student_id = ?";

    con.query(sql, [student_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post(`/nodeapp/getdiscussion`, (req, res) => {
    let student_id = req.body.student_id;

    const sql = "select * from `Discussion` where Student_id = ?";

    con.query(sql, [student_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post(`/nodeapp/getdocuments`, (req, res) => {
    let student_id = req.body.student_id;

    const sql = "select * from `Documents` where Student_id = ?";

    con.query(sql, [student_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post(`/nodeapp/getcorporateinquiry`, (req, res) => {
    const sql = "select * from `Corporate_Inquiry` where IsDelete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post(`/nodeapp/getcorporateinquiryform`, (req, res) => {
    let id = req.body.id;

    const sql = "select * from `Corporate_Inquiry` where Id = ? ";

    con.query(sql, [id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/add_companyinfo`, (req, res) => {
    let Company = req.body.Company;
    let BussinessNature = req.body.BussinessNature;
    let Designation = req.body.Designation;
    let Duration = req.body.Duration;
    let student_id = req.body.student_id;

    const sql =
        "insert into Company_info(`Company`,`BussinessNature`,`Designation`,`Duration`,`student_id`) values(?,?,?,?,?)";

    con.query(sql, [Company, BussinessNature, Designation, Duration, student_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});





app.post("/nodeapp/upload_doc", upload.single("image"), (req, res) => {
    const doc_name = req.body.doc_name || "document";
    const student_id = req.body.student_id;
    const ext = path.extname(req.file.originalname);
    const safeName = doc_name.replace(/\s+/g, "_");
    const filename = `${safeName}${ext}`;

    const uploadDir = path.join(__dirname, `../uploads/student_document/${student_id}`);

    // Create folder if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);

    try {
        // Write the file from memory to disk
        fs.writeFileSync(filePath, req.file.buffer);

        // Now insert into DB
        const sql = "INSERT INTO Documents(`upload_image`, `doc_name`, `Student_id`) VALUES (?, ?, ?)";
        con.query(sql, [filename, doc_name, student_id], (err, data) => {
            if (err) {
                return res.status(500).json({ success: false, error: err });
            } else {
                return res.json({ success: true, filename, data });
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: "File save failed", detail: err.message });
    }
});



app.post("/nodeapp/updateStudent", (req, res, next) => {
    const {
        Student_Id,
        studentName,
        permanentemail,
        Batch_Code,
        gender,
        nationality,
        dob,
        password,
        reference,
        presentaddress,
        presentPincode,
        presentCity,
        state,
        presentCountry,
        mobile,
        whatsapp,
        course,
        category,
        Referby,
        admission_dt,
        prestatus,
        changestatus,
        date,
        permanentAdress,
        permanentPincode,
        permanentCity,
        permanentState,
        permanentCountry,
        permanentmobile,
        perWatsapp,
        prestatusdate,
    } = req.body;

    const sql =
        "UPDATE Student_Master SET  Student_Name = ?, Sex = ?, DOB = ?, Present_Mobile = ?, Course_Id = ?,Batch_Code = ?,Nationality =?, Refered_By = ?,Present_Address =? ,Present_Pin = ?,Present_City = ?,Present_State= ? ,Present_Country = ? ,Batch_Category_id = ? ,Admission_Dt = ? ,Status_date = ? , Status_id = ? ,StateChangeDt = ? ,Permanent_Address = ?,Permanent_Pin = ?,Permanent_City = ?,Permanent_State =? ,Permanent_Country = ?,Permanent_Tel = ? ,Email = ? , IsUnread = ?  WHERE Student_Id = ?";

    con.query(
        sql,
        [
            studentName,
            gender,
            dob,
            mobile,
            course,
            Batch_Code,
            nationality,
            Referby,
            presentaddress,
            presentPincode,
            presentCity,
            state,
            presentCountry,
            category,
            admission_dt,
            date,
            changestatus,
            prestatusdate,
            permanentAdress,
            permanentPincode,
            permanentCity,
            permanentState,
            permanentCountry,
            permanentmobile,
            permanentemail,
            1,
            Student_Id,
        ],
        (error, data) => {
            if (error) {
                res.json(error);
                return;
            }

            return res.status(200).json(data);
        }
    );
});

app.post("/nodeapp/getPersonal", (req, res, next) => {
    const { admissionid } = req.body;

    const sql =
        "SELECT sm.*,bm.SDate , bm.EDate,bm.Batch_Id ,bm.INR_Total,stm.Status , am.Student_Code FROM Student_Master as sm LEFT join Admission_master as am on am.Student_Id =sm.Student_Id left join Batch_Mst as bm on bm.Batch_code = sm.Batch_Code left join Fees_Structure as fs on bm.Batch_Id = fs.batch_id left join Status_Master as stm on stm.Id = sm.Status_id WHERE sm.Student_Id = ?";

    con.query(sql, [admissionid], (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        } else {

            const Email = data[0].Email;

            const checkbatchdetails = 'select bm.Batch_code from Student_Master as sm left join Admission_master as am on am.Student_Id = sm.Student_Id left JOIN Batch_Mst as bm on bm.Batch_Id = am.Batch_Id  where sm.Email = ? and  sm.status_id = 8 and sm.IsDelete = 0'

            con.query(checkbatchdetails, [Email], (error, batchdata) => {
                if (error) {
                    return res.json(error)
                } else {
                    return res.json({ data: data, batchdata: batchdata })
                }

            })
        }
        // return res.status(200).json(data);
    });


});

app.post("/nodeapp/postCorporateInquiry", (req, res, next) => {
    const {
        firstname,
        lastname,
        middilename,
        Mobile,
        Phone,
        Email,
        CompanyName,
        Designation,
        Country,
        Address,
        Pin,
        City,
        State,
        Place,
        id,
    } = req.body;

    const sql =
        "update `CorporateInquiry` set Fname = ? , Lname=? , MName = ? ,CompanyName = ? ,Address = ? ,City =? ,State =? ,Country = ?,Pin = ? ,Mobile = ?,Email = ?,Place = ? where Id = ?  ";

    con.query(
        sql,
        [firstname, lastname, middilename, CompanyName, Address, City, State, Country, Pin, Mobile, Email, Place, id],
        (error, data) => {
            if (error) {
                res.status(500).json(error);
                return;
            }
            return res.status(200).json(data);
        }
    );
});

app.post("/nodeapp/postqualification", (req, res, next) => {
    const { studentId, qualification, descipline, college, uni, passYear, grade, status, kt, remark, u_id } = req.body;

    let sql;
    let param;

    if (u_id == undefined) {
        sql =
            "INSERT INTO awt_academicqualification (Student_id ,Qualification,Discipline, College , University ,PassingYear,Percentage,Status,KT,remark) VALUES(?,?,?,?,?,?,?,?,?,?)";

        param = [studentId, qualification, descipline, college, uni, passYear, grade, status, kt, remark];
    } else {
        sql =
            "update awt_academicqualification set Qualification = ?, Discipline = ?,College = ?,University = ?,PassingYear = ?,Percentage = ? ,Status = ?, KT = ? , remark = ?  where id = ?";
        param = [qualification, descipline, college, uni, passYear, grade, status, kt, remark, u_id];
    }

    con.query(sql, param, (error, data) => {
        if (error) {
            res.status(500).json(error);
            return;
        }

        return res.status(200).json({
            message: "Qualifications Added.",
            data: data,
        });
    });
});

app.post("/nodeapp/acqualification_update", (req, res) => {
    let u_id = req.body.u_id;

    const sql = "select * from awt_academicqualification where id = ?";

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

// ==============================Lecture takene

app.post("/nodeapp/add_lecturetaken", (req, res) => {
    let {
        course,
        batch,
        lecture,
        classroom,
        lecturedate,
        lecturefrom,
        lectureto,
        faculty,
        facultytime,
        timeto,
        assignmentadate,
        enddate,
        materialissued,
        material,
        assignmentgive,
        assignment,
        testgiven,
        test,
        topicdescuss,
        nextplanning,
        uid,
    } = req.body;

    let sql;
    let param;



    const getlecture = 'select * from Batch_SLecture_Master where id = ?';

    con.query(getlecture, [lecture], (err, data) => {
        if (err) {
            return res.json(err)
        } else {

            if (err) {
                return res.json(err);
            } else if (!data.length) {
                return res.status(404).json({ message: 'Lecture not found' });
            }


            const subject = data[0].subject_topic;
            const subject_topic = data[0].subject_topic;

            if (uid == undefined) {
                sql =
                    "insert into lecture_taken_master (`Course_Id`,`Batch_Id`,`Lecture_Id`,`ClassRoom`,`Take_Dt`,`Lecture_Start`,`Lecture_End`,`Faculty_Id`,`Faculty_Start`,`Faculty_End`,`Assign_Start`,`Assign_End`,`Assignment_Id`,`Material`,`Assign_Given`,`Test_Given`,`Test_Id`,`Next_Planning`,`Lecture_Name`, `Topic`) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

                param = [
                    course,
                    batch,
                    lecture,
                    classroom,
                    lecturedate,
                    lecturefrom,
                    lectureto,
                    faculty,
                    facultytime,
                    timeto,
                    assignmentadate,
                    enddate,
                    assignment,
                    materialissued,
                    assignmentgive,
                    testgiven,
                    test,
                    nextplanning,
                    subject_topic,
                    subject
                ];
            } else {
                sql =
                    "update `lecture_taken_master` set Course_Id =? ,Batch_Id = ? ,Lecture_Id = ?,ClassRoom = ? ,Take_Dt = ? ,Lecture_Start = ?,Lecture_End = ?,Faculty_Id = ? ,Faculty_Start = ? ,Faculty_End = ? ,Assign_Start =?,Assign_End = ? ,Assignment_Id = ?, Material =?,Assign_Given = ? ,Test_Given = ?,Test_Id = ?  ,Next_Planning = ? ,Lecture_Name = ? ,Topic = ?   where Take_Id =?";

                param = [
                    course,
                    batch,
                    lecture,
                    classroom,
                    lecturedate,
                    lecturefrom,
                    lectureto,
                    faculty,
                    facultytime,
                    timeto,
                    assignmentadate,
                    enddate,
                    assignment,
                    materialissued,
                    assignmentgive,
                    testgiven,
                    test,
                    nextplanning,
                    subject_topic,
                    subject,
                    uid,
                ];
            }

            con.query(sql, param, (err, data) => {
                if (err) {
                    return res.json(err);
                } else {
                    const TakeId = data.insertId;

                    if (TakeId) {
                        // const getdata = `SELECT sm.Student_Id, sm.Student_Name FROM Batch_Mst as bm LEFT JOIN Student_Master as sm ON bm.Batch_code = sm.Batch_code WHERE bm.Batch_Id = ? AND bm.isDelete = 0 AND sm.isDelete = 0`;
                        const getdata = `SELECT DISTINCT  sm.Student_Id,sm.Student_Name FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_Id = ?`;

                        con.query(getdata, [batch], (err, result) => {
                            if (err) {
                                return res.json(err);
                            } else {
                                let insertions = result.map((item) => {
                                    const { Student_Id, Student_Name } = item;
                                    const insert = `INSERT INTO Lecture_taken_child (Take_Id, Student_Id, Student_Name, isDelete,Student_Reaction) VALUES (?, ?, ?, ?,?)`;

                                    return new Promise((resolve, reject) => {
                                        con.query(insert, [TakeId, Student_Id, Student_Name, 0, "excellent"], (err, data) => {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                resolve("Data Inserted");
                                            }
                                        });
                                    });
                                });

                                Promise.all(insertions)
                                    .then((results) => res.json({ msg: "Data Inserted", TakeId: TakeId }))
                                    .catch((error) => res.json(error));
                            }
                        });
                    } else {
                        return res.json("Main data inserted");
                    }
                }
            });

        }

    });


});

app.post(`/nodeapp/add_lecturechild`, (req, res) => {
    let batch_id = req.body.batch_id;
});

app.post(`/nodeapp/getlecturetakendata`, (req, res) => {
    const { page = 0, pageSize = 10 } = req.body;

    // Calculate the offset for pagination
    const offset = page * pageSize;

    const sql =
        "select ltm.Take_Id,ltm.Lecture_Name,ltm.Take_Dt,bm.Batch_code as Batch_Id,ltm.Topic,fm.Faculty_Name as Faculty_Id from lecture_taken_master as ltm LEFT JOIN Batch_Mst as bm on bm.Batch_Id = ltm.Batch_Id LEFT join faculty_master as fm on fm.Faculty_Id = ltm.Faculty_Id  where ltm.IsDelete = 0 order by ltm.Take_Id desc LIMIT ? OFFSET ?";

    con.query(sql, [pageSize, offset], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            let lastStudentId = null;
            let lastTakeId = null;
            if (data.length > 0) {
                lastTakeId = data[data.length - 1].Take_Id;
            }
            return res.json({ data, lastTakeId });
        }
    });
});

app.post(`/nodeapp/geteditlecturetaken`, (req, res) => {
    let { Takeid } = req.body;

    const sql =
        "select lt.ID, lt.Student_Id , am.Student_Code,lt.Student_Name,lt.Student_Reaction,lt.Student_Atten, lt.In_Time , lt.Out_Time, lt.AssignmentReceived , lt.Late from `Lecture_taken_child` as lt left join Admission_master as am on am.Student_Id = lt.Student_Id  where lt.IsDelete = 0 and lt.Take_Id = ? group by lt.Student_Id ORDER BY lt.Student_Name ";

    con.query(sql, [Takeid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post(`/nodeapp/geteditassignmenttaken`, (req, res) => {
    let { GivenId } = req.body;

    const sql =
        "select  am.Student_Code , ag.* from `Assignment_given_child` as ag left join Admission_master as am on am.Student_Id = ag.Student_Id  where ag.IsDelete = 0 and ag.Given_Id = ? group by ag.Student_Id Order by ag.Student_Name ASC";

    con.query(sql, [GivenId], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/geteditunittesttaken`, (req, res) => {
    let { Takeid } = req.body;

    const sql =
        "select  am.Student_Code , ag.* from `Test_taken_child` as ag left join Admission_master as am on am.Student_Id = ag.Student_Id  where ag.IsDelete = 0 and ag.Take_Id = ? group by ag.Student_Id Order by ag.Student_Name ASC";

    con.query(sql, [Takeid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});




app.post(`/nodeapp/geteditvivataken`, (req, res) => {
    let { Takeid } = req.body;

    const sql =
        "select  am.Student_Code , ag.* from `viva_taken_child` as ag left join Admission_master as am on am.Student_Id = ag.Student_Id  where ag.IsDelete = 0 and ag.Take_Id = ? group by ag.Student_Id Order by ag.Student_Name ASC";

    con.query(sql, [Takeid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post(`/nodeapp/geteditfinalexam`, (req, res) => {
    let { Takeid } = req.body;

    const sql =
        "select  am.Student_Code , ag.* from `Exam_taken_child` as ag left join Admission_master as am on am.Student_Id = ag.Student_Id  where ag.IsDelete = 0 and ag.Take_Id = ? group by ag.Student_Id Order by ag.Student_Name ASC";

    con.query(sql, [Takeid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/assignment_taken`, (req, res) => {
    let { batch_id } = req.body;

    const sql = "select * from assignmentstaken where deleted = 0 and batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/getbatchmoc`, (req, res) => {
    let { batch_id } = req.body;

    const sql = "select * from Batch_Moc_Master where deleted = 0 and batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/getbatchfeedback`, (req, res) => {
    let { batch_id } = req.body;

    const sql = "select * from Batch_Feedback_Master where deleted = 0 and batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/batch_standardlecture`, (req, res) => {
    let { batch_id } = req.body;

    const sql = "select asm.* , au.subject as unitname , ast.assignmentname  from Batch_SLecture_Master as asm left JOIN awt_unittesttaken as au on asm.unit_test = au.id LEFT JOIN assignmentstaken as ast on ast.id = asm.assignment where asm.deleted = 0 and asm.batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/batch_lecturetaken`, (req, res) => {
    let { batch_id } = req.body;

    const sql =
        "select asm.* , au.subject as unitname , ast.assignmentname  from Batch_Lecture_Master as asm left JOIN awt_unittesttaken as au on asm.unit_test = au.id LEFT JOIN assignmentstaken as ast on ast.id = asm.assignment where asm.deleted = 0 and asm.batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/batch_convocation`, (req, res) => {
    let { batch_id } = req.body;

    const sql = "select * from Convocation_Guest_List where IsDelete = 0 and batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post(`/nodeapp/batch_result_Structure`, (req, res) => {
    let { batch_id } = req.body;

    const sql =
        "select LateMarkLimit,AttendWtg,ExamWtg,AssignWtg,UnitTestWtg,FullAttendWtg from Batch_Mst where IsDelete = 0 and Batch_Id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_assignmentdetails", (req, res) => {
    let { assingmentname, subject, marks, date, uid, batch_id } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into assignmentstaken( `batch_id`,`assignmentname`,`subjects`,`marks`,`assignmentdate`) values(?,?,?,?,?)";

        param = [batch_id, assingmentname, subject, marks, date];
    } else {
        sql =
            "update `assignmentstaken` set `batch_id` =?, `assignmentname` =? , `subjects` =? , `marks` =? , `assignmentdate` =? where id =?";

        param = [batch_id, assingmentname, subject, marks, date, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_Unittest", (req, res) => {
    let { subject, testdate, duration, marks, uid, batch_id } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into awt_unittesttaken(`batch_id`,`subject`, `utdate`,`duration`,`marks`) values(?,?,?,?,?)";

        param = [batch_id, subject, testdate, duration, marks];
    } else {
        sql =
            "update `awt_unittesttaken` set `batch_id` = ? , `subject` =? , `utdate` =? , `duration` =? ,marks =?  where id =?";

        param = [batch_id, subject, testdate, duration, marks, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_finalexam", (req, res) => {
    let { subject, examdate, duration, maxmarks, uid, batch_id } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into Batch_final_exam(`batch_id`,`subject`, `date`,`duration`,`maxmarks`) values(?,?,?,?,?)";

        param = [batch_id, subject, examdate, duration, maxmarks];
    } else {
        sql =
            "update `Batch_final_exam` set `batch_id` = ? , `subject` =? , `date` =? , `duration` =? ,maxmarks =?  where id =?";

        param = [batch_id, subject, examdate, duration, maxmarks, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_assignmentstaken", (req, res) => {
    let { coursename, batchcode, assignmentname, assignmentdate, returndate, uid, marks, assignno } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into Assignment_taken(`Course_Id`,`Batch_Id`, `Assignment_Id`,`Assign_Dt`,`Return_Dt`,`Marks`,`Assign_No`) values(?,?,?,?,?,?,?)";

        param = [coursename, batchcode, assignmentname, assignmentdate, returndate, marks, assignno];
    } else {
        sql =
            "update `Assignment_taken` set `Course_Id` = ? , `Batch_Id` =? , `Assignment_Id` =? , `Assign_Dt` =? ,Return_Dt =?,Marks = ?,Assign_No = ?  where Given_Id =?";

        param = [coursename, batchcode, assignmentname, assignmentdate, returndate, marks, assignno, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            const GivenId = data.insertId;

            if (GivenId) {
                const getdata = `SELECT DISTINCT  sm.Student_Id,sm.Student_Name FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_Id = ?`;

                con.query(getdata, [batchcode], (err, result) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        let insertions = result.map((item) => {
                            const { Student_Id, Student_Name } = item;

                            const insert = `INSERT INTO Assignment_given_child (Given_Id, Student_Id, Student_Name, isDelete, Status) VALUES (?, ?, ?, ?, ?)`;

                            return new Promise((resolve, reject) => {
                                con.query(insert, [GivenId, Student_Id, Student_Name, 0, "Present"], (err, data) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve("Data Inserted");
                                    }
                                });
                            });
                        });

                        Promise.all(insertions)
                            .then((results) => res.json({ msg: "Data Inserted", TakeId: GivenId }))
                            .catch((error) => res.json(error));
                    }
                });
            } else {
                return res.json("Main data inserted");
            }
        }
    });
});

app.post("/nodeapp/add_Moc", (req, res) => {
    let { subject, date, marks, uid, batch_id } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into Batch_Moc_Master(`batch_id`,`subject`, `date`,`marks`) values(?,?,?,?)";

        param = [batch_id, subject, date, marks];
    } else {
        sql = "update `Batch_Moc_Master` set `batch_id` = ? ,`subject` =? , `date` =? ,`marks` =?  where id =?";

        param = [batch_id, subject, date, marks, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_batchstandardlecture", (req, res) => {
    let {
        lecture_no,
        subject_topic,
        starttime,
        endtime,
        assignment,
        assignment_date,
        faculty_name,
        class_room,
        documents,
        unit_test,
        subject,
        date,
        uid,
        batch_id,
        duration,
        publish,
        day,
        module,
        planned,
        department,
        practicetest,
        lecturecontent,
        status,
    } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "INSERT INTO Batch_SLecture_Master(`batch_id`,`lecture_no`, `subject_topic`,`starttime`,`endtime`,`assignment`,`assignment_date`,`faculty_name`,`duration`,`class_room`,`documents`,`unit_test`,`publish`,`subject`,`date`,`lectureday`,`module`,`planned`,`department`,`practicetest`,`lecturecontent`,`status`) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            batch_id,
            lecture_no,
            subject_topic,
            starttime,
            endtime,
            assignment,
            assignment_date,
            faculty_name,
            duration,
            class_room,
            documents,
            unit_test,
            publish,
            subject,
            date,
            day,
            module,
            planned,
            department,
            practicetest,
            lecturecontent,
            status,
        ];
    } else {
        sql =
            "update `Batch_SLecture_Master` set batch_id = ? ,lecture_no =? , subject_topic =? ,starttime =? ,endtime =? ,assignment = ?,assignment_date =? ,faculty_name = ? ,duration = ?,class_room = ? , documents =? ,unit_test = ?,publish = ? ,subject = ?,date =?,lectureday =?,module =?,planned =?,department =?,practicetest = ? ,lecturecontent = ? ,status = ? where id =?";

        param = [
            batch_id,
            lecture_no,
            subject_topic,
            starttime,
            endtime,
            assignment,
            assignment_date,
            faculty_name,
            duration,
            class_room,
            documents,
            unit_test,
            publish,
            subject,
            date,
            day,
            module,
            planned,
            department,
            practicetest,
            lecturecontent,
            status,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {

            if (data.insertId > 0) {
                const sql2 =
                    "INSERT INTO Batch_Lecture_Master(`batch_id`,`lecture_no`, `subject_topic`,`starttime`,`endtime`,`assignment`,`assignment_date`,`faculty_name`,`duration`,`class_room`,`documents`,`unit_test`,`publish`,`subject`,`date`,`lectureday`,`module`,`planned`,`department`,`practicetest`,`lecturecontent`,`status`,`deleted`) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

                const param2 = [
                    batch_id,
                    lecture_no,
                    subject_topic,
                    starttime,
                    endtime,
                    assignment,
                    assignment_date,
                    faculty_name,
                    duration,
                    class_room,
                    documents,
                    unit_test,
                    publish,
                    subject,
                    date,
                    day,
                    module,
                    planned,
                    department,
                    practicetest,
                    lecturecontent,
                    status,
                    0,
                ];

                con.query(sql2, param2, (err, data2) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        return res.json(data2);
                    }
                });
            } else {
                return res.json(data);
            }

        }
    });
});

app.post("/nodeapp/add_batchlecturetaken", (req, res) => {
    let {
        lecture_no,
        subject_topic,
        starttime,
        endtime,
        assignment,
        assignment_date,
        faculty_name,
        class_room,
        documents,
        unit_test,
        subject,
        date,
        marks,
        uid,
        batch_id,
        duration,
        publish,
        day,
        module,
        planned,
        department,
        practicetest,
        lecturecontent,
        status,
    } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "INSERT INTO Batch_Lecture_Master(`batch_id`,`lecture_no`, `subject_topic`,`starttime`,`endtime`,`assignment`,`assignment_date`,`faculty_name`,`duration`,`class_room`,`documents`,`unit_test`,`publish`,`subject`,`date`,`marks`,`lectureday`,`module`,`planned`,`department`,`practicetest`,`lecturecontent`,`status`) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            batch_id,
            lecture_no,
            subject_topic,
            starttime,
            endtime,
            assignment,
            assignment_date,
            faculty_name,
            duration,
            class_room,
            documents,
            unit_test,
            publish,
            subject,
            date,
            marks,
            day,
            module,
            planned,
            department,
            practicetest,
            lecturecontent,
            status,
        ];
    } else {
        sql =
            "update `Batch_Lecture_Master` set batch_id = ? ,lecture_no =? , subject_topic =? ,starttime =? ,endtime =? ,assignment = ?,assignment_date =? ,faculty_name = ? ,duration = ?,class_room = ? , documents =? ,unit_test = ?,publish = ? ,subject = ?,date =?,marks =? ,lectureday =?,module =?,planned =?,department =?,practicetest = ? ,lecturecontent = ? ,status = ? where id =?";

        param = [
            batch_id,
            lecture_no,
            subject_topic,
            starttime,
            endtime,
            assignment,
            assignment_date,
            faculty_name,
            duration,
            class_room,
            documents,
            unit_test,
            publish,
            subject,
            date,
            marks,
            day,
            module,
            planned,
            department,
            practicetest,
            lecturecontent,
            status,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_batchconvocation", (req, res) => {
    let { batch_id, fname, gname, mobile_no, email_id, gdesig } = req.body;

    const created_date = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const insertSql = `
        INSERT INTO Convocation_Guest_List
        (Batch_Id, FName, GName, Mobile_no, Email_id, GDesig,DateAdded)
        VALUES (?, ?, ?, ?, ?, ?,?)
    `;

    const insertParams = [batch_id, fname, gname, mobile_no, email_id, gdesig, created_date];

    con.query(insertSql, insertParams, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json({ message: "Inserted and updated successfully", data });
        }
    });
});


app.post("/nodeapp/update_convocationdate", (req, res) => {
    let { batch_id, convocation_date, convocation_day } = req.body;

    const updateSql = `UPDATE Batch_Mst
                SET ConvocationDate = ? , Convocationday = ?
                WHERE Batch_Id = ? 
            `;

    const updateParams = [convocation_date, convocation_day, batch_id];

    con.query(updateSql, updateParams, (err2, updateData) => {
        if (err2) {
            return res.json(err2);
        } else {
            return res.json({ message: "Inserted and updated successfully", updateData });
        }
    });
});


app.post("/nodeapp/add_BatchFeedback", (req, res) => {
    let { subject, date, uid, batch_id } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into Batch_Feedback_Master(`batch_id`,`subject`, `date`) values(?,?,?)";

        param = [batch_id, subject, date];
    } else {
        sql = "update `Batch_Feedback_Master` set `batch_id` = ? ,`subject` =? , `date` =?  where id =?";

        param = [batch_id, subject, date, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_assignmenttaken", (req, res) => {
    let { coursename, batchcode, assignmentname, assignmentdate, returndate, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql =
            "insert into assignmentstaken(`coursename`,`batchcode`,`assignmentname`,`assignmentdate`,`returndate`) values(?,?,?,?,?)";

        param = [coursename, batchcode, assignmentname, assignmentdate, returndate];
    } else {
        sql =
            "update `assignmentstaken` set `coursename` =? , `batchcode` =? , `assignmentname` =? , `assignmentdate` =? , `returndate` =? where id = ?";

        param = [coursename, batchcode, assignmentname, assignmentdate, returndate, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/Unit_test`, (req, res) => {
    let { batch_id } = req.body;

    const sql = "select * from awt_unittesttaken where deleted = 0 and batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_unittesttaken", (req, res) => {
    let { coursename, batch_id, utname, unit_no, utdate, uid, marks } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into Test_taken_master(`Course_Id`,`Batch_Id`,`Test_Id`,`Test_Dt`,`Marks`,`Test_No`) values(?,?,?,?,?,?)";

        param = [coursename, batch_id, utname, utdate, marks, unit_no];
    } else {
        sql =
            "update `Test_taken_master` set `Course_Id` =? , `Batch_Id` =? , `Test_Id` =? , `Test_Dt` =? , `Marks` =? ,`Test_No`= ?  where Take_Id = ?";

        param = [coursename, batch_id, utname, utdate, marks, unit_no, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            const GivenId = data.insertId;

            if (GivenId) {
                const getdata = `SELECT DISTINCT  sm.Student_Id,sm.Student_Name FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_Id = ?`;

                con.query(getdata, [batch_id], (err, result) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        let insertions = result.map((item) => {
                            const { Student_Id, Student_Name } = item;

                            // console.log(stu)
                            const insert = `INSERT INTO Test_taken_child (Take_Id, Student_Id, Student_Name, isDelete, Status) VALUES (?, ?, ?, ?, ?)`;

                            return new Promise((resolve, reject) => {
                                con.query(insert, [GivenId, Student_Id, Student_Name, 0, "Present"], (err, data) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve("Data Inserted");
                                    }
                                });
                            });
                        });

                        Promise.all(insertions)
                            .then((results) => res.json({ msg: "Data Inserted", Take_Id: GivenId }))
                            .catch((error) => res.json(error));
                    }
                });
            } else {
                return res.json("Main data Updated");
            }
        }
    });
});

app.post("/nodeapp/add_vivamoctaken", (req, res) => {
    let { coursename, batchcode, vivamocname, date, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into viva_taken(`Course_Id`,`Batch_Id`,`Viva_Id`,`Take_Dt`) values(?,?,?,?)";

        param = [coursename, batchcode, vivamocname, date];
    } else {
        sql = "update `viva_taken` set `Course_Id` =? , `Batch_Id` =? , `Viva_Id` =? , `Take_Dt` =? where Take_Id = ?";

        param = [coursename, batchcode, vivamocname, date, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            const Takeid = data.insertId;

            if (Takeid) {
                const getdata = `SELECT DISTINCT  sm.Student_Id,sm.Student_Name FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_Id = ?`;

                con.query(getdata, [batchcode], (err, result) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        let insertions = result.map((item) => {
                            const { Student_Id, Student_Name } = item;

                            const insert = `INSERT INTO viva_taken_child (Take_Id, Student_Id, Student_Name, isDelete, Status) VALUES (?, ?, ?, ?, ?)`;

                            return new Promise((resolve, reject) => {
                                con.query(insert, [Takeid, Student_Id, Student_Name, 0, "Present"], (err, data) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve("Data Inserted");
                                    }
                                });
                            });
                        });

                        Promise.all(insertions)
                            .then((results) => res.json({ msg: "Data Inserted", Take_Id: Takeid }))
                            .catch((error) => res.json(error));
                    }
                });
            } else {
                return res.json("Main data inserted");
            }
        }
    });
});

app.post("/nodeapp/add_finalexamtaken", (req, res) => {
    let { course_id, batch_id, date, uid, testid, marks, Test_No } = req.body;

    let sql;
    let param;

    console.log(uid, "WW");
    console.log(typeof uid, "WW");

    if (uid == undefined) {
        sql =
            "insert into Final_exam_master(`Course_Id`,`Batch_Id`,`Test_Id`,`Test_Dt`,`Marks`,`Test_No`) values(?,?,?,?,?,?)";

        param = [course_id, batch_id, testid, date, marks, Test_No];
    } else {
        sql =
            "update `Final_exam_master` set `Course_Id` =? , `Batch_Id` =? , `Test_Id` =? , `Test_Dt` =?, `Marks` = ? , `Test_No` =? where Take_Id = ?";

        param = [course_id, batch_id, testid, date, marks, Test_No, uid];
    }

    con.query(sql, param, (err, data) => {
        console.log(sql, "DDD");
        if (err) {
            return res.json(err);
        } else {
            const Takeid = data.insertId;

            if (Takeid) {
                const getdata = `SELECT DISTINCT  sm.Student_Id,sm.Student_Name FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_Id = ?`;

                con.query(getdata, [batch_id], (err, result) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        let insertions = result.map((item) => {
                            const { Student_Id, Student_Name } = item;

                            const insert = `INSERT INTO Exam_taken_child (Take_Id, Student_Id, Student_Name, isDelete, Status) VALUES (?, ?, ?, ?, ?)`;

                            return new Promise((resolve, reject) => {
                                con.query(insert, [Takeid, Student_Id, Student_Name, 0, "Present"], (err, data) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve("Data Inserted");
                                    }
                                });
                            });
                        });

                        Promise.all(insertions)
                            .then((results) => res.json({ msg: "Data Inserted", TakeId: Takeid }))
                            .catch((error) => res.json(error));
                    }
                });
            } else {
                return res.json("Main data inserted");
            }
        }
    });
});





const queryPromise = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        con.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

app.post("/nodeapp/add_generateresult", async (req, res) => {
    let {
        course,
        batch,
        returndate,
        printdate,
        faculty1,
        faculty2,
        label1,
        label2,
        approved,
        startdate,
        enddate,
        uid,
    } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into generate_final_result(`Course_Id`,`Batch_Id`,`Result_date`,`Print_date`,`Label1`,`Faculty1`,`Label2`,`Faculty2`,`Approve`,`Start_date`,`End_date`,`IsDelete`) values(?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            course,
            batch,
            returndate,
            printdate,
            label1,
            faculty1,
            label2,
            faculty2,
            approved,
            startdate,
            enddate,
            0,
        ];
    } else {
        sql =
            "update `generate_final_result` set `Course_Id` =? , `Batch_Id` =? , `Result_date` =? , `Print_date` =? , `Label1` =? , `Faculty1` =? , `Label2` =? ,`Faculty2` = ?,`Approve` =? ,`Start_date` = ? ,`End_date` = ?  where id = ?";

        param = [
            course,
            batch,
            returndate,
            printdate,
            label1,
            faculty1,
            label2,
            faculty2,
            approved,
            startdate,
            enddate,
            uid,
        ];
    }

    try {

        const data = await new Promise((resolve, reject) => {
            con.query(sql, param, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });


        const GenID = data.insertId;


        if (GenID) {
            // Function to insert data into 'generate_final_child'
            const insertData = (groupedData) => {
                let insertions = Object.values(groupedData).map((student) => {
                    const {
                        Student_Id,
                        Student_Code,
                        Student_Name,
                        assignmentData,
                        testData,
                        assignmentAverage,
                        testAverage,
                        FinalData,
                        Final_Avg,
                        Viva_Marks,
                        Grade
                    } = student;

                    const ass_avg = assignmentAverage.toFixed(2);
                    const test_avg = testAverage.toFixed(2);
                    const finalavg = Final_Avg.toFixed(2);
                    const finalper = assignmentAverage + testAverage + Final_Avg - Math.abs(Viva_Marks);
                    const finalpercentage = finalper.toFixed(2);

                    // Build the query fields and values for both assignment and test at once
                    const queryFields = `Ass1_Given, Ass1_Max, Ass1_Status, Ass2_Given, Ass2_Max, Ass2_Status,
                                                                                                                                                                 Ass3_Given, Ass3_Max, Ass3_Status, Ass4_Given, Ass4_Max, Ass4_Status,
                                                                                                                                                                 Ass5_Given, Ass5_Max, Ass5_Status, Ass6_Given, Ass6_Max, Ass6_Status,
                                                                                                                                                                 Ass7_Given, Ass7_Max, Ass7_Status, Ass8_Given, Ass8_Max, Ass8_Status,
                                                                                                                                                                 Ass9_Given, Ass9_Max, Ass9_Status, Ass10_Given, Ass10_Max, Ass10_Status,
                                                                                                                                                                 Test1_Given, Test1_Max, Test1_Status, Test2_Given, Test2_Max, Test2_Status,
                                                                                                                                                                 Test3_Given, Test3_Max, Test3_Status, Test4_Given, Test4_Max, Test4_Status,
                                    Test5_Given, Test5_Max, Test5_Status, Test6_Given, Test6_Max, Test6_Status,Test7_Given, Test7_Max, Test7_Status, Test8_Given, Test8_Max, Test8_Status,Test9_Given, Test9_Max, Test9_Status, Test10_Given, Test10_Max, Test10_Status,Ass_Percent,Test_Percent,Final1_Given,Final1_Max,           Final1_Status,Final2_Given,Final2_Max,Final2_Status,Final3_Given,Final3_Max,Final3_Status,Final_Percent,Discipline , Final_Result_Percent , Grade`;

                    // Combine both assignment and test data into the same query values array
                    const queryValues = [
                        assignmentData.Ass1_Given,
                        assignmentData.Ass1_Max,
                        assignmentData.Ass1_Status,
                        assignmentData.Ass2_Given,
                        assignmentData.Ass2_Max,
                        assignmentData.Ass2_Status,
                        assignmentData.Ass3_Given,
                        assignmentData.Ass3_Max,
                        assignmentData.Ass3_Status,
                        assignmentData.Ass4_Given,
                        assignmentData.Ass4_Max,
                        assignmentData.Ass4_Status,
                        assignmentData.Ass5_Given,
                        assignmentData.Ass5_Max,
                        assignmentData.Ass5_Status,
                        assignmentData.Ass6_Given,
                        assignmentData.Ass6_Max,
                        assignmentData.Ass6_Status,
                        assignmentData.Ass7_Given,
                        assignmentData.Ass7_Max,
                        assignmentData.Ass7_Status,
                        assignmentData.Ass8_Given,
                        assignmentData.Ass8_Max,
                        assignmentData.Ass8_Status,
                        assignmentData.Ass9_Given,
                        assignmentData.Ass9_Max,
                        assignmentData.Ass9_Status,
                        assignmentData.Ass10_Given,
                        assignmentData.Ass10_Max,
                        assignmentData.Ass10_Status,
                        testData.Test1_Given,
                        testData.Test1_Max,
                        testData.Test1_Status,
                        testData.Test2_Given,
                        testData.Test2_Max,
                        testData.Test2_Status,
                        testData.Test3_Given,
                        testData.Test3_Max,
                        testData.Test3_Status,
                        testData.Test4_Given,
                        testData.Test4_Max,
                        testData.Test4_Status,
                        testData.Test5_Given,
                        testData.Test5_Max,
                        testData.Test5_Status,
                        testData.Test6_Given,
                        testData.Test6_Max,
                        testData.Test6_Status,
                        testData.Test7_Given,
                        testData.Test7_Max,
                        testData.Test7_Status,
                        testData.Test8_Given,
                        testData.Test8_Max,
                        testData.Test8_Status,
                        testData.Test9_Given,
                        testData.Test9_Max,
                        testData.Test9_Status,
                        testData.Test10_Given,
                        testData.Test10_Max,
                        testData.Test10_Status,
                        ass_avg,
                        test_avg,
                        FinalData.Final1_Given,
                        FinalData.Final1_Max,
                        FinalData.Final1_Status,
                        FinalData.Final2_Given,
                        FinalData.Final2_Max,
                        FinalData.Final2_Status,
                        FinalData.Final3_Given,
                        FinalData.Final3_Max,
                        FinalData.Final3_Status,
                        finalavg,
                        Viva_Marks,
                        finalpercentage,
                        Grade
                    ];

                    // Prepare insert query
                    const insertQuery = `INSERT INTO generate_final_child (Gen_id, Batch_Id, Student_Code, Student_Name, ${queryFields}) VALUES (?, ?, ?, ?, ${queryValues.map(() => "?").join(", ")})`;

                    return new Promise((resolve, reject) => {
                        con.query(
                            insertQuery,
                            [GenID, batch, Student_Code, Student_Name, ...queryValues],
                            (err, childdata) => {
                                if (err) {
                                    console.error("Error inserting data:", err);
                                    return reject(err);
                                } else {
                                    const childid = childdata.insertId;

                                    const getattendetail =
                                        "SELECT COUNT(*) as total_lecture, SUM(CASE WHEN ltc.Student_Atten = 'Absent' THEN 1 ELSE 0 END) AS total_absent ,SUM(CASE WHEN ltc.Student_Atten = 'Present' THEN 1 ELSE 0 END) AS total_present ,ROUND(SUM(CASE WHEN ltc.Student_Atten = 'Present' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as atten_per FROM`lecture_taken_master` as ltm LEFT JOIN Lecture_taken_child as ltc on ltc.Take_Id = ltm.Take_Id WHERE ltc.Student_Id = ? and ltm.Batch_Id = ? and ltm.IsDelete = 0";

                                    con.query(getattendetail, [Student_Id, batch], (err, data) => {
                                        if (err) {
                                            return reject(err);
                                        } else {

                                            const Total_Lectures = data[0].total_lecture;
                                            const AttenLectures = data[0].total_present;
                                            const Absents = data[0].total_absent;
                                            const Atten_Per = data[0].atten_per;

                                            const updateattend =
                                                "update `generate_final_child` set Total_Lectures = ?,Full_Attendance = ?,Full_Attend =?,Absents = ?,AttenLectures = ? where id = ?";

                                            con.query(
                                                updateattend,
                                                [
                                                    Total_Lectures,
                                                    Atten_Per,
                                                    Atten_Per,
                                                    Absents,
                                                    AttenLectures,
                                                    childid,
                                                ],
                                                (err, data) => {
                                                    if (err) {
                                                        return reject(err);
                                                    } else {
                                                        const getassigndetails =
                                                            "SELECT COUNT(*) as total_assignment,SUM(CASE WHEN agc.Status = 'Present' THEN 1 ELSE 0 END) AS total_given FROM Assignment_taken as atn LEFT join Assignment_given_child as agc on agc.Given_Id = atn.Given_Id WHERE  atn.Batch_Id = ? AND agc.Student_Id = ? AND atn.IsDelete = 0";

                                                        con.query(
                                                            getassigndetails,
                                                            [batch, Student_Id],
                                                            (err, assigndata) => {
                                                                if (err) {
                                                                    return reject(err);
                                                                } else {
                                                                    const Total_assignment =
                                                                        assigndata[0].total_assignment;
                                                                    const Total_given = assigndata[0].total_given;

                                                                    const updateassign =
                                                                        "update `generate_final_child` set Total_Assignments =? ,Given_Assignments =? where id = ?";

                                                                    con.query(
                                                                        updateassign,
                                                                        [Total_assignment, Total_given, childid],
                                                                        (err, data) => {
                                                                            if (err) {
                                                                                return reject(err);
                                                                            } else {
                                                                                const gettestdetails =
                                                                                    "SELECT COUNT(*) as total_test,SUM(CASE WHEN ttc.Status = 'Present' THEN 1 ELSE 0 END) AS total_given FROM Test_taken_master as ttm LEFT join Test_taken_child as ttc on ttc.Take_Id = ttm.Take_Id WHERE  ttm.Batch_Id = ? AND ttc.Student_Id = ? AND ttm.IsDelete = 0";

                                                                                con.query(
                                                                                    gettestdetails,
                                                                                    [batch, Student_Id],
                                                                                    (err, testdata) => {
                                                                                        if (err) {
                                                                                            return reject(err);
                                                                                        } else {
                                                                                            const Total_test =
                                                                                                testdata[0]
                                                                                                    .total_test;
                                                                                            const Total_given =
                                                                                                testdata[0]
                                                                                                    .total_given;

                                                                                            const updatetest =
                                                                                                "update `generate_final_child` set Total_Tests =? ,Given_Tests =? where id = ?";

                                                                                            con.query(
                                                                                                updatetest,
                                                                                                [
                                                                                                    Total_test,
                                                                                                    Total_given,
                                                                                                    childid,
                                                                                                ],
                                                                                                (err, data) => {
                                                                                                    if (err) return reject(err);
                                                                                                    resolve("Inserted Successfully");
                                                                                                }
                                                                                            );
                                                                                        }
                                                                                    }
                                                                                );
                                                                            }
                                                                        }
                                                                    );
                                                                }
                                                            }
                                                        );
                                                    }
                                                }
                                            );
                                        }
                                    });
                                }
                            }
                        );
                    });
                });

                return Promise.all(insertions);
            };

            const assignmentQuery = `SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, atn.Assign_No, agc.Marks_Given, atn.Marks, agc.Status
        FROM Admission_master as am 
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN Assignment_given_child as agc ON agc.Student_Id = sm.Student_Id 
        LEFT JOIN Assignment_taken as atn ON atn.Given_Id = agc.Given_Id 
        WHERE atn.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0 AND am.isDelete = 0 AND agc.isDelete = 0 and atn.IsDelete = 0
      `;

            const testQuery = `
        SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, ttm.Test_No, ttc.Marks_Given as Test_Marks_Given, ttm.Marks as Test_Marks, ttc.Status as Test_Status
        FROM Admission_master as am  
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN Test_taken_child as ttc ON ttc.Student_Id = sm.Student_Id AND ttc.isDelete = 0
        LEFT JOIN Test_taken_master as ttm ON ttm.Take_Id = ttc.Take_Id AND ttm.isDelete = 0
        WHERE ttm.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0
      `;

            const finalQuery = `
        SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, fem.Test_No as Final_test_No, etc.Marks_Given as Final_Mark_Given, fem.Marks as Final_Marks, etc.Status as Final_Status
        FROM Admission_master as am
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN Exam_taken_child as etc ON etc.Student_Id = sm.Student_Id AND etc.isDelete = 0
        LEFT JOIN Final_exam_master as fem ON fem.Take_Id = etc.Take_Id AND fem.isDelete = 0
        WHERE fem.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0
      `;


            const vivaquery = `SELECT sm.Student_Id, am.Student_Code, sm.Student_Name,  sm.Student_Id,vtc.Marks_Given as Viva_Marks
        FROM Admission_master as am
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN viva_taken_child as vtc ON vtc.Student_Id = sm.Student_Id AND vtc.isDelete = 0
        LEFT JOIN viva_taken as vt ON vt.Take_Id = vtc.Take_Id AND vt.isDelete = 0
        WHERE vt.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0`

            const getgrade = `SELECT start_from, end_from, grade FROM grades WHERE batch_id = ?`

            const [assignmentData, testData, finalData, vivadata, gradeData] = await Promise.all([
                queryPromise(assignmentQuery, [batch]),
                queryPromise(testQuery, [batch]),
                queryPromise(finalQuery, [batch]),
                queryPromise(vivaquery, [batch]),
                queryPromise(getgrade, [batch]),
            ]);


            const combinedData = {};

            function calculateGrade(score, gradeList) {
                for (let i = 0; i < gradeList.length; i++) {
                    const { start_from, end_from, grade } = gradeList[i];
                    if (score >= start_from && score <= end_from) {
                        return grade;
                    }
                }
                return 'NA'; // Fallback
            }

            // Process assignments
            assignmentData.forEach((row) => {
                const {
                    Student_Id = "",
                    Student_Code = "",
                    Student_Name = "",
                    Assign_No = "",
                    Marks_Given = 0,
                    Marks = 0,
                    Status = ""
                } = row;

                if (!combinedData[Student_Id]) {
                    combinedData[Student_Id] = {
                        Student_Id,
                        Student_Code,
                        Student_Name,
                        assignmentData: {},
                        testData: {},
                        FinalData: {},
                        Viva_Marks: 0,
                    };
                }

                combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Given`] = Marks_Given;
                combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Max`] = Marks || 0;
                combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Status`] = Status;
            });

            // Process tests
            testData.forEach((row) => {
                const {
                    Student_Id = "",
                    Student_Code = "",
                    Student_Name = "",
                    Test_No = "",
                    Test_Marks_Given = 0,
                    Test_Marks = 0,
                    Test_Status = ""
                } = row;

                if (!combinedData[Student_Id]) {
                    combinedData[Student_Id] = {
                        Student_Id,
                        Student_Code,
                        Student_Name,
                        assignmentData: {},
                        testData: {},
                        FinalData: {},
                        Viva_Marks: 0,
                    };
                } else {
                    // Ensure student name/code is filled if missing
                    if (!combinedData[Student_Id].Student_Code) combinedData[Student_Id].Student_Code = Student_Code;
                    if (!combinedData[Student_Id].Student_Name) combinedData[Student_Id].Student_Name = Student_Name;
                }

                combinedData[Student_Id].testData[`Test${Test_No}_Given`] = Test_Marks_Given;
                combinedData[Student_Id].testData[`Test${Test_No}_Max`] = Test_Marks || 0;
                combinedData[Student_Id].testData[`Test${Test_No}_Status`] = Test_Status;
            });

            finalData.forEach((row) => {
                const {
                    Student_Id = "",
                    Student_Code = "",
                    Student_Name = "",
                    Final_test_No = "",
                    Final_Mark_Given = 0,
                    Final_Marks = 0,
                    Final_Status = "",
                } = row;

                if (!combinedData[Student_Id]) {
                    combinedData[Student_Id] = {
                        Student_Id,
                        Student_Code: "",
                        Student_Name: "",
                        assignmentData: {},
                        testData: {},
                        FinalData: {},
                        Viva_Marks: 0,
                    };
                } else {
                    // Ensure student name/code is filled if missing
                    if (!combinedData[Student_Id].Student_Code) combinedData[Student_Id].Student_Code = Student_Code;
                    if (!combinedData[Student_Id].Student_Name) combinedData[Student_Id].Student_Name = Student_Name;
                }

                combinedData[Student_Id].FinalData[`Final${Final_test_No}_Given`] = Final_Mark_Given;
                combinedData[Student_Id].FinalData[`Final${Final_test_No}_Max`] = Final_Marks || 0;
                combinedData[Student_Id].FinalData[`Final${Final_test_No}_Status`] = Final_Status;
            });

            vivadata.forEach((row) => {
                const {
                    Student_Id = "",
                    Viva_Marks = 0
                } = row;

                if (!combinedData[Student_Id]) {
                    combinedData[Student_Id] = {
                        Student_Id,
                        Student_Code: "",
                        Student_Name: "",
                        assignmentData: {},
                        testData: {},
                        FinalData: {},
                        Viva_Marks: 0,
                    };
                } {
                    // Ensure student name/code is filled if missing
                    if (!combinedData[Student_Id].Student_Code) combinedData[Student_Id].Student_Code = Student_Code;
                    if (!combinedData[Student_Id].Student_Name) combinedData[Student_Id].Student_Name = Student_Name;
                }

                combinedData[Student_Id].Viva_Marks = Viva_Marks || 0;
            });




            // Calculate Averages
            Object.keys(combinedData).forEach((studentId) => {
                const student = combinedData[studentId];

                // Assignment Avg (Max 15 marks)
                let assignGiven = 0;
                let assignMax = 0;

                Object.keys(student.assignmentData || {}).forEach((key) => {
                    if (key.includes('_Given')) {
                        const index = key.split('_')[0]; // e.g., "Ass1"
                        const g = student.assignmentData[`${index}_Given`] || 0;
                        const m = student.assignmentData[`${index}_Max`] || 0;

                        assignGiven += g;
                        assignMax += m;  // Always add Max, even if marks are zero
                    }
                });

                student.assignmentAverage = assignMax > 0 ? (assignGiven / assignMax) * 15 : 0;

                // Test Avg (Max 35 marks)
                let testGiven = 0,
                    testMax = 0;
                Object.keys(student.testData || {}).forEach((key) => {
                    if (key.includes('_Given')) {
                        const index = key.split('_')[0]; // e.g., "Test1"
                        const g = student.testData[`${index}_Given`] || 0;
                        const m = student.testData[`${index}_Max`] || 0;

                        testGiven += g;
                        testMax += m;

                    }
                });
                student.testAverage = testMax > 0 ? (testGiven / testMax) * 35 : 0;

                // Final Avg (Max 50 marks)
                let finalGiven = 0,
                    finalMax = 0;
                Object.keys(student.FinalData || {}).forEach((key) => {
                    if (key.includes('_Given')) {
                        const index = key.split('_')[0]; // e.g., "Final1"
                        const g = Number(student.FinalData[`${index}_Given`] || 0);
                        const m = Number(student.FinalData[`${index}_Max`] || 0);

                        finalGiven += g;
                        finalMax += m;

                    }
                });
                student.Final_Avg = finalMax > 0 ? (finalGiven / finalMax) * 50 : 0;

                // Convert negative Viva_Marks (e.g., -10) into positive deduction
                const vivaDeduction = Math.abs(student.Viva_Marks || 0);

                // Store the raw viva deduction (optional for display/debug)
                student.Viva_Avg = vivaDeduction;

                // Compute total after deducting viva marks (treated as penalty in %)
                const total = Math.max(0,
                    student.assignmentAverage +
                    student.testAverage +
                    student.Final_Avg -
                    vivaDeduction
                );

                // Store total percentage and grade
                student.TotalPercentage = total.toFixed(2);
                student.Grade = calculateGrade(total, gradeData);
            });

            // Insert all students' processed data
            await insertData(combinedData);

            res.json("Data Inserted Successfully");
        }



    } catch (err) {
        console.error("Error in add_generateresult:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }


});


// app.post("/nodeapp/update_generateresult", async (req, res) => {

//     res.json("Data Inserted Successfully");
// });

// app.post("/nodeapp/update_generateresult", async (req, res) => {
//     let {
//         course,
//         batch,
//         returndate,
//         printdate,
//         faculty1,
//         faculty2,
//         label1,
//         label2,
//         approved,
//         startdate,
//         enddate,
//         uid,
//     } = req.body;

//     let sql;
//     let param;

//     sql =
//         "update `generate_final_result` set `Course_Id` =? , `Batch_Id` =? , `Result_date` =? , `Print_date` =? , `Label1` =? , `Faculty1` =? , `Label2` =? ,`Faculty2` = ?,`Approve` =? ,`Start_date` = ? ,`End_date` = ?  where id = ?";

//     param = [
//         course,
//         batch,
//         returndate,
//         printdate,
//         label1,
//         faculty1,
//         label2,
//         faculty2,
//         approved,
//         startdate,
//         enddate,
//         uid,
//     ];

//     try {

//         await new Promise((resolve, reject) => {
//             con.query(sql, param, (err, data) => {
//                 if (err) reject(err);
//                 else resolve(data);
//             });
//         });

//         const deleteSql = `DELETE FROM generate_final_child WHERE Batch_Id = ?`;

//         await new Promise((resolve, reject) => {
//             con.query(deleteSql, [batch], (err, result) => {
//                 if (err) return reject(err);
//                 resolve(result);
//             });
//         });




//         const intOrZero = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));


//         // Function to insert data into 'generate_final_child'
//         const insertData = (groupedData) => {
//             let insertions = Object.values(groupedData).map((student) => {


//                 const {
//                     Student_Id,
//                     Student_Code,
//                     Student_Name,
//                     assignmentData,
//                     testData,
//                     assignmentAverage,
//                     testAverage,
//                     FinalData,
//                     Final_Avg,
//                     Viva_Marks,
//                     Grade
//                 } = student;
//                 const ass_avg = student.assignmentAverage;
//                 const test_avg = student.testAverage;
//                 const finalavg = student.Final_Avg;          // out of 50
//                const finalpercentage = Number(student.TotalPercentage || 0);




//                 // Build the query fields and values for both assignment and test at once
//                 const queryFields = `Ass1_Given, Ass1_Max, Ass1_Status, Ass2_Given, Ass2_Max, Ass2_Status,
//                                                                                                                                                                  Ass3_Given, Ass3_Max, Ass3_Status, Ass4_Given, Ass4_Max, Ass4_Status,
//                                                                                                                                                                  Ass5_Given, Ass5_Max, Ass5_Status, Ass6_Given, Ass6_Max, Ass6_Status,
//                                                                                                                                                                  Ass7_Given, Ass7_Max, Ass7_Status, Ass8_Given, Ass8_Max, Ass8_Status,
//                                                                                                                                                                  Ass9_Given, Ass9_Max, Ass9_Status, Ass10_Given, Ass10_Max, Ass10_Status,
//                                                                                                                                                                  Test1_Given, Test1_Max, Test1_Status, Test2_Given, Test2_Max, Test2_Status,
//                                                                                                                                                                  Test3_Given, Test3_Max, Test3_Status, Test4_Given, Test4_Max, Test4_Status,
//                                     Test5_Given, Test5_Max, Test5_Status, Test6_Given, Test6_Max, Test6_Status,Test7_Given, Test7_Max, Test7_Status, Test8_Given, Test8_Max, Test8_Status,Test9_Given, Test9_Max, Test9_Status, Test10_Given, Test10_Max, Test10_Status,Ass_Percent,Test_Percent,Final1_Given,Final1_Max,           Final1_Status,Final2_Given,Final2_Max,Final2_Status,Final3_Given,Final3_Max,Final3_Status,Final_Percent,Discipline , Final_Result_Percent , Grade`;

//                 // Combine both assignment and test data into the same query values array
//                 const queryValues = [
//                     // ===== Assignments =====
//                     intOrZero(assignmentData.Ass1_Given),
//                     intOrZero(assignmentData.Ass1_Max),
//                     assignmentData.Ass1_Status || '',

//                     intOrZero(assignmentData.Ass2_Given),
//                     intOrZero(assignmentData.Ass2_Max),
//                     assignmentData.Ass2_Status || '',

//                     intOrZero(assignmentData.Ass3_Given),
//                     intOrZero(assignmentData.Ass3_Max),
//                     assignmentData.Ass3_Status || '',

//                     intOrZero(assignmentData.Ass4_Given),
//                     intOrZero(assignmentData.Ass4_Max),
//                     assignmentData.Ass4_Status || '',

//                     intOrZero(assignmentData.Ass5_Given),
//                     intOrZero(assignmentData.Ass5_Max),
//                     assignmentData.Ass5_Status || '',

//                     intOrZero(assignmentData.Ass6_Given),
//                     intOrZero(assignmentData.Ass6_Max),
//                     assignmentData.Ass6_Status || '',

//                     intOrZero(assignmentData.Ass7_Given),
//                     intOrZero(assignmentData.Ass7_Max),
//                     assignmentData.Ass7_Status || '',

//                     intOrZero(assignmentData.Ass8_Given),
//                     intOrZero(assignmentData.Ass8_Max),
//                     assignmentData.Ass8_Status || '',

//                     intOrZero(assignmentData.Ass9_Given),
//                     intOrZero(assignmentData.Ass9_Max),
//                     assignmentData.Ass9_Status || '',

//                     intOrZero(assignmentData.Ass10_Given),
//                     intOrZero(assignmentData.Ass10_Max),
//                     assignmentData.Ass10_Status || '',

//                     // ===== Tests =====
//                     intOrZero(testData.Test1_Given),
//                     intOrZero(testData.Test1_Max),
//                     testData.Test1_Status || '',

//                     intOrZero(testData.Test2_Given),
//                     intOrZero(testData.Test2_Max),
//                     testData.Test2_Status || '',

//                     intOrZero(testData.Test3_Given),
//                     intOrZero(testData.Test3_Max),
//                     testData.Test3_Status || '',

//                     intOrZero(testData.Test4_Given),
//                     intOrZero(testData.Test4_Max),
//                     testData.Test4_Status || '',

//                     intOrZero(testData.Test5_Given),
//                     intOrZero(testData.Test5_Max),
//                     testData.Test5_Status || '',

//                     intOrZero(testData.Test6_Given),
//                     intOrZero(testData.Test6_Max),
//                     testData.Test6_Status || '',

//                     intOrZero(testData.Test7_Given),
//                     intOrZero(testData.Test7_Max),
//                     testData.Test7_Status || '',

//                     intOrZero(testData.Test8_Given),
//                     intOrZero(testData.Test8_Max),
//                     testData.Test8_Status || '',

//                     intOrZero(testData.Test9_Given),
//                     intOrZero(testData.Test9_Max),
//                     testData.Test9_Status || '',

//                     intOrZero(testData.Test10_Given),
//                     intOrZero(testData.Test10_Max),
//                     testData.Test10_Status || '',

//                     // ===== Averages (INT ONLY) =====
//                     ass_avg.toFixed(2),
//                     test_avg.toFixed(2),

//                     // ===== Final Exams =====
//                     intOrZero(FinalData.Final1_Given),
//                     intOrZero(FinalData.Final1_Max),
//                     FinalData.Final1_Status || '',

//                     intOrZero(FinalData.Final2_Given),
//                     intOrZero(FinalData.Final2_Max),
//                     FinalData.Final2_Status || '',

//                     intOrZero(FinalData.Final3_Given),
//                     intOrZero(FinalData.Final3_Max),
//                     FinalData.Final3_Status || '',

//                     finalavg.toFixed(2),          // Final_Percent
//                     intOrZero(Viva_Marks),        // Discipline
//                     finalpercentage.toFixed(2),   // Final_Result_Percent
//                     Grade
//                 ];


//                 // Prepare insert query
//                 const insertQuery = `INSERT INTO generate_final_child (Gen_id, Batch_Id, Student_Code, Student_Name, ${queryFields}) VALUES (?, ?, ?, ?, ${queryValues.map(() => "?").join(", ")})`;
//                 return new Promise((resolve, reject) => {
//                     con.query(
//                         insertQuery,
//                         [uid, batch, Student_Code, Student_Name, ...queryValues],
//                         (err, childdata) => {
//                             if (err) {
//                                 console.error("Error inserting data:", err);
//                                 return reject(err);
//                             } else {
//                                 const childid = childdata.insertId;

//                                 const getattendetail =
//                                     "SELECT COUNT(*) as total_lecture, SUM(CASE WHEN ltc.Student_Atten = 'Absent' THEN 1 ELSE 0 END) AS total_absent ,SUM(CASE WHEN ltc.Student_Atten = 'Present' THEN 1 ELSE 0 END) AS total_present ,ROUND(SUM(CASE WHEN ltc.Student_Atten = 'Present' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as atten_per FROM`lecture_taken_master` as ltm LEFT JOIN Lecture_taken_child as ltc on ltc.Take_Id = ltm.Take_Id WHERE ltc.Student_Id = ? and ltm.Batch_Id = ? and ltm.IsDelete = 0";

//                                 con.query(getattendetail, [Student_Id, batch], (err, data) => {
//                                     if (err) {
//                                         return reject(err);
//                                     } else {

//                                         const Total_Lectures = data[0].total_lecture;
//                                         const AttenLectures = data[0].total_present;
//                                         const Absents = data[0].total_absent;
//                                         const Atten_Per = data[0].atten_per;

//                                         const updateattend =
//                                             "update `generate_final_child` set Total_Lectures = ?,Full_Attendance = ?,Full_Attend =?,Absents = ?,AttenLectures = ? where id = ?";

//                                         con.query(
//                                             updateattend,
//                                             [
//                                                 Total_Lectures,
//                                                 Atten_Per,
//                                                 Atten_Per,
//                                                 Absents,
//                                                 AttenLectures,
//                                                 childid,
//                                             ],
//                                             (err, data) => {
//                                                 if (err) {
//                                                     return reject(err);
//                                                 } else {
//                                                     const getassigndetails =
//                                                         "SELECT COUNT(*) as total_assignment,SUM(CASE WHEN agc.Status = 'Present' THEN 1 ELSE 0 END) AS total_given FROM Assignment_taken as atn LEFT join Assignment_given_child as agc on agc.Given_Id = atn.Given_Id WHERE  atn.Batch_Id = ? AND agc.Student_Id = ? AND atn.IsDelete = 0";

//                                                     con.query(
//                                                         getassigndetails,
//                                                         [batch, Student_Id],
//                                                         (err, assigndata) => {
//                                                             if (err) {
//                                                                 return reject(err);
//                                                             } else {
//                                                                 const Total_assignment =
//                                                                     assigndata[0].total_assignment;
//                                                                 const Total_given = assigndata[0].total_given;

//                                                                 const updateassign =
//                                                                     "update `generate_final_child` set Total_Assignments =? ,Given_Assignments =? where id = ?";

//                                                                 con.query(
//                                                                     updateassign,
//                                                                     [Total_assignment, Total_given, childid],
//                                                                     (err, data) => {
//                                                                         if (err) {
//                                                                             return reject(err);
//                                                                         } else {
//                                                                             const gettestdetails =
//                                                                                 "SELECT COUNT(*) as total_test,SUM(CASE WHEN ttc.Status = 'Present' THEN 1 ELSE 0 END) AS total_given FROM Test_taken_master as ttm LEFT join Test_taken_child as ttc on ttc.Take_Id = ttm.Take_Id WHERE  ttm.Batch_Id = ? AND ttc.Student_Id = ? AND ttm.IsDelete = 0";

//                                                                             con.query(
//                                                                                 gettestdetails,
//                                                                                 [batch, Student_Id],
//                                                                                 (err, testdata) => {
//                                                                                     if (err) {
//                                                                                         return reject(err);
//                                                                                     } else {
//                                                                                         const Total_test =
//                                                                                             testdata[0]
//                                                                                                 .total_test;
//                                                                                         const Total_given =
//                                                                                             testdata[0]
//                                                                                                 .total_given;

//                                                                                         const updatetest =
//                                                                                             "update `generate_final_child` set Total_Tests =? ,Given_Tests =? where id = ?";

//                                                                                         con.query(
//                                                                                             updatetest,
//                                                                                             [
//                                                                                                 Total_test,
//                                                                                                 Total_given,
//                                                                                                 childid,
//                                                                                             ],
//                                                                                             (err, data) => {
//                                                                                                 if (err) return reject(err);
//                                                                                                 resolve("Inserted Successfully");
//                                                                                             }
//                                                                                         );
//                                                                                     }
//                                                                                 }
//                                                                             );
//                                                                         }
//                                                                     }
//                                                                 );
//                                                             }
//                                                         }
//                                                     );
//                                                 }
//                                             }
//                                         );
//                                     }
//                                 });
//                             }
//                         }
//                     );
//                 });
//             });

//             return Promise.all(insertions);
//         };

//         const assignmentQuery = `SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, atn.Assign_No, agc.Marks_Given, atn.Marks, agc.Status
//         FROM Admission_master as am 
//         LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
//         LEFT JOIN Assignment_given_child as agc ON agc.Student_Id = sm.Student_Id 
//         LEFT JOIN Assignment_taken as atn ON atn.Given_Id = agc.Given_Id 
//         WHERE atn.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0 AND am.isDelete = 0 AND agc.isDelete = 0 and atn.IsDelete = 0
//       `;

//         const testQuery = `
//         SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, ttm.Test_No, ttc.Marks_Given as Test_Marks_Given, ttm.Marks as Test_Marks, ttc.Status as Test_Status
//         FROM Admission_master as am  
//         LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
//         LEFT JOIN Test_taken_child as ttc ON ttc.Student_Id = sm.Student_Id AND ttc.isDelete = 0
//         LEFT JOIN Test_taken_master as ttm ON ttm.Take_Id = ttc.Take_Id AND ttm.isDelete = 0
//         WHERE ttm.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0
//       `;

//         const finalQuery = `
//         SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, fem.Test_No as Final_test_No, etc.Marks_Given as Final_Mark_Given, fem.Marks as Final_Marks, etc.Status as Final_Status
//         FROM Admission_master as am
//         LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
//         LEFT JOIN Exam_taken_child as etc ON etc.Student_Id = sm.Student_Id AND etc.isDelete = 0
//         LEFT JOIN Final_exam_master as fem ON fem.Take_Id = etc.Take_Id AND fem.isDelete = 0
//         WHERE fem.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0
//       `;


//         const vivaquery = `SELECT sm.Student_Id, am.Student_Code, sm.Student_Name,  sm.Student_Id,vtc.Marks_Given as Viva_Marks
//         FROM Admission_master as am
//         LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
//         LEFT JOIN viva_taken_child as vtc ON vtc.Student_Id = sm.Student_Id AND vtc.isDelete = 0
//         LEFT JOIN viva_taken as vt ON vt.Take_Id = vtc.Take_Id AND vt.isDelete = 0
//         WHERE vt.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0`

//         const getgrade = `SELECT start_from, end_from, grade FROM grades WHERE batch_id = ?`

//         const [assignmentData, testData, finalData, vivadata, gradeData] = await Promise.all([
//             queryPromise(assignmentQuery, [batch]),
//             queryPromise(testQuery, [batch]),
//             queryPromise(finalQuery, [batch]),
//             queryPromise(vivaquery, [batch]),
//             queryPromise(getgrade, [batch]),
//         ]);


//         // ================= COMBINE DATA =================
//         const combinedData = {};

//         // Helper to safely convert numbers

//         // ----------------- Process Assignments -----------------
//         assignmentData.forEach((row) => {
//             const { Student_Id = "", Student_Code = "", Student_Name = "", Assign_No = "", Marks_Given = 0, Marks = 0, Status = "" } = row;

//             if (!combinedData[Student_Id]) {
//                 combinedData[Student_Id] = { Student_Id, Student_Code, Student_Name, assignmentData: {}, testData: {}, FinalData: {}, Viva_Marks: 0 };
//             }

//             combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Given`] = intOrZero(Marks_Given);
//             combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Max`] = intOrZero(Marks);
//             combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Status`] = Status;
//         });

//         // ----------------- Process Tests -----------------
//         testData.forEach((row) => {
//             const { Student_Id = "", Student_Code = "", Student_Name = "", Test_No = "", Test_Marks_Given = 0, Test_Marks = 0, Test_Status = "" } = row;

//             if (!combinedData[Student_Id]) {
//                 combinedData[Student_Id] = { Student_Id, Student_Code, Student_Name, assignmentData: {}, testData: {}, FinalData: {}, Viva_Marks: 0 };
//             }

//             combinedData[Student_Id].testData[`Test${Test_No}_Given`] = intOrZero(Test_Marks_Given);
//             combinedData[Student_Id].testData[`Test${Test_No}_Max`] = intOrZero(Test_Marks);
//             combinedData[Student_Id].testData[`Test${Test_No}_Status`] = Test_Status;
//         });

//         // ----------------- Process Final Exams -----------------
//         finalData.forEach((row) => {
//             const { Student_Id = "", Final_test_No = "", Final_Mark_Given = null, Final_Marks = null, Final_Status = "" } = row;

//             if (!combinedData[Student_Id]) {
//                 combinedData[Student_Id] = { Student_Id, Student_Code: "", Student_Name: "", assignmentData: {}, testData: {}, FinalData: {}, Viva_Marks: 0 };
//             }

//             if (Final_Mark_Given !== null && Final_Marks !== null) {
//                 combinedData[Student_Id].FinalData[`Final${Final_test_No}_Given`] = Number(Final_Mark_Given);
//                 combinedData[Student_Id].FinalData[`Final${Final_test_No}_Max`] = Number(Final_Marks);
//                 combinedData[Student_Id].FinalData[`Final${Final_test_No}_Status`] = Final_Status;
//             }
//         });

//         // ----------------- Process Viva -----------------
//         vivadata.forEach((row) => {
//             const { Student_Id = "", Viva_Marks = 0 } = row;

//             if (!combinedData[Student_Id]) {
//                 combinedData[Student_Id] = { Student_Id, Student_Code: "", Student_Name: "", assignmentData: {}, testData: {}, FinalData: {}, Viva_Marks: 0 };
//             }

//             combinedData[Student_Id].Viva_Marks = intOrZero(Viva_Marks);
//         });

//         // ----------------- Calculate Averages & Total -----------------
//         Object.keys(combinedData).forEach((studentId) => {
//             const student = combinedData[studentId];

//             // ----- Assignment Average (15%) -----
//             let assignGiven = 0, assignMax = 0;
//             Object.keys(student.assignmentData || {}).forEach((key) => {
//                 if (key.endsWith("_Given")) {
//                     const base = key.replace("_Given", "");
//                     assignGiven += intOrZero(student.assignmentData[`${base}_Given`]);
//                     assignMax += intOrZero(student.assignmentData[`${base}_Max`]);
//                 }
//             });
//             const assignPercent = assignMax > 0 ? (assignGiven / assignMax) * 100 : 0;
//             student.assignmentAverage = (assignPercent * 15) / 100;

//             // ----- Test Average (35%) -----
//             let testGiven = 0, testMax = 0;
//             Object.keys(student.testData || {}).forEach((key) => {
//                 if (key.endsWith("_Given")) {
//                     const base = key.replace("_Given", "");
//                     testGiven += intOrZero(student.testData[`${base}_Given`]);
//                     testMax += intOrZero(student.testData[`${base}_Max`]);
//                 }
//             });
//             const testPercent = testMax > 0 ? (testGiven / testMax) * 100 : 0;
//             student.testAverage = (testPercent * 35) / 100;

//             // ----- Final Exam Average (50%) -----
//             let finalGiven = 0, finalMax = 0;
//             Object.keys(student.FinalData || {}).forEach((key) => {
//                 if (key.endsWith("_Given")) {
//                     const base = key.replace("_Given", "");
//                     const given = student.FinalData[`${base}_Given`];
//                     const max = student.FinalData[`${base}_Max`];
//                     if (given !== null && given !== undefined) finalGiven += Number(given);
//                     if (max !== null && max !== undefined) finalMax += Number(max);
//                 }
//             });
//             const finalPercent = finalMax > 0 ? (finalGiven / finalMax) * 100 : 0;
//             student.Final_Avg = (finalPercent * 50) / 100;

//             // ----- Total Percentage -----
//             const vivaDeduction = intOrZero(student.Viva_Marks);
//             const total = student.assignmentAverage + student.testAverage + student.Final_Avg - vivaDeduction;
//             student.TotalPercentage = Math.max(0, total).toFixed(2);

//             // ----- Grade -----
//             student.Grade = calculateGrade(student.TotalPercentage, gradeData);
//         });

//         // ================= CALCULATE + BUILD DEBUG LOG =================
//         const calculationProof = [];

//         Object.keys(combinedData).forEach((studentId) => {
//             const student = combinedData[studentId];

//             /* ---------------- ASSIGNMENTS (15%) ---------------- */
//             let assignGiven = 0, assignMax = 0;
//             const assignBreakup = [];

//             Object.keys(student.assignmentData || {}).forEach((key) => {
//                 if (key.endsWith("_Given")) {
//                     const base = key.replace("_Given", "");
//                     const given = intOrZero(student.assignmentData[`${base}_Given`]);
//                     const max = intOrZero(student.assignmentData[`${base}_Max`]);

//                     assignGiven += given;
//                     assignMax += max;

//                     assignBreakup.push({ exam: base, given, max });
//                 }
//             });

//             const assignPercent = assignMax > 0 ? (assignGiven / assignMax) * 100 : 0;
//             const assignmentAverage = (assignPercent * 15) / 100;


//             /* ---------------- TESTS (35%) ---------------- */
//             let testGiven = 0, testMax = 0;
//             const testBreakup = [];

//             Object.keys(student.testData || {}).forEach((key) => {
//                 if (key.endsWith("_Given")) {
//                     const base = key.replace("_Given", "");
//                     const given = intOrZero(student.testData[`${base}_Given`]);
//                     const max = intOrZero(student.testData[`${base}_Max`]);

//                     testGiven += given;
//                     testMax += max;

//                     testBreakup.push({ exam: base, given, max });
//                 }
//             });

//             const testPercent = testMax > 0 ? (testGiven / testMax) * 100 : 0;
//             const testAverage = (testPercent * 35) / 100;


//             /* ---------------- FINAL (50%) ---------------- */
//             let finalGiven = 0, finalMax = 0;
//             const finalBreakup = [];

//             Object.keys(student.FinalData || {}).forEach((key) => {
//                 if (key.endsWith("_Given")) {
//                     const base = key.replace("_Given", "");
//                     const given = Number(student.FinalData[`${base}_Given`] || 0);
//                     const max = Number(student.FinalData[`${base}_Max`] || 0);

//                     finalGiven += given;
//                     finalMax += max;

//                     finalBreakup.push({ exam: base, given, max });
//                 }
//             });

//             const finalPercent = finalMax > 0 ? (finalGiven / finalMax) * 100 : 0;
//             const finalAverage = (finalPercent * 50) / 100;


//             /* ---------------- TOTAL ---------------- */
//             const vivaDeduction = intOrZero(student.Viva_Marks);
//             const rawTotal = assignmentAverage + testAverage + finalAverage;
//             const finalTotal = Math.max(0, rawTotal - vivaDeduction).toFixed(2);

//             student.assignmentAverage = assignmentAverage;
//             student.testAverage = testAverage;
//             student.Final_Avg = finalAverage;
//             student.TotalPercentage = finalTotal;
//             student.Grade = calculateGrade(finalTotal, gradeData);


//             /* ---------------- PUSH PROOF ---------------- */
//             calculationProof.push({
//                 Student_Id: student.Student_Id,
//                 Student_Name: student.Student_Name,
//                 Student_Code: student.Student_Code,

//                 Assignment: {
//                     breakup: assignBreakup,
//                     totalGiven: assignGiven,
//                     totalMax: assignMax,
//                     percent: assignPercent.toFixed(2),
//                     weighted15: assignmentAverage.toFixed(2)
//                 },

//                 Test: {
//                     breakup: testBreakup,
//                     totalGiven: testGiven,
//                     totalMax: testMax,
//                     percent: testPercent.toFixed(2),
//                     weighted35: testAverage.toFixed(2)
//                 },

//                 Final: {
//                     breakup: finalBreakup,
//                     totalGiven: finalGiven,
//                     totalMax: finalMax,
//                     percent: finalPercent.toFixed(2),
//                     weighted50: finalAverage.toFixed(2)
//                 },

//                 Viva_Deduction: vivaDeduction,
//                 Raw_Total: rawTotal.toFixed(2),
//                 Final_Total: finalTotal,
//                 Grade: student.Grade
//             });
//         });

//         // Insert all students' processed data
//         await insertData(combinedData);


//         res.json("Data Updated");

//         // return res.status(200).json({
//         //     status: true,
//         //     message: "Result calculated with raw proof",
//         //     data: combinedData,
//         //     calculationProof // 🔥 THIS IS YOUR LOG
//         // });



//     } catch (err) {
//         console.error("Error in add_generateresult:", err);
//         res.status(500).json({ message: "Internal Server Error", error: err });
//     }


// });

app.post("/nodeapp/update_generateresult", async (req, res) => {
    let {
        course,
        batch,
        returndate,
        printdate,
        faculty1,
        faculty2,
        label1,
        label2,
        approved,
        startdate,
        enddate,
        uid,
    } = req.body;

    let sql;
    let param;

    sql =
        "update `generate_final_result` set `Course_Id` =? , `Batch_Id` =? , `Result_date` =? , `Print_date` =? , `Label1` =? , `Faculty1` =? , `Label2` =? ,`Faculty2` = ?,`Approve` =? ,`Start_date` = ? ,`End_date` = ?  where id = ?";

    param = [
        course,
        batch,
        returndate,
        printdate,
        label1,
        faculty1,
        label2,
        faculty2,
        approved,
        startdate,
        enddate,
        uid,
    ];

    try {

        await new Promise((resolve, reject) => {
            con.query(sql, param, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        const deleteSql = `DELETE FROM generate_final_child WHERE Batch_Id = ?`;

        await new Promise((resolve, reject) => {
            con.query(deleteSql, [batch], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });





        // Function to insert data into 'generate_final_child'
        const insertData = (groupedData) => {
            let insertions = Object.values(groupedData).map((student) => {
                const {
                    Student_Id,
                    Student_Code,
                    Student_Name,
                    assignmentData,
                    testData,
                    assignmentAverage,
                    testAverage,
                    FinalData,
                    Final_Avg,
                    Viva_Marks,
                    Grade
                } = student;

                const ass_avg = assignmentAverage.toFixed(2);
                const test_avg = testAverage.toFixed(2);
                const finalavg = Final_Avg.toFixed(2);
                const finalpercentage = student.TotalPercentage;

                // Build the query fields and values for both assignment and test at once
                const queryFields = `Ass1_Given, Ass1_Max, Ass1_Status, Ass2_Given, Ass2_Max, Ass2_Status,
                                                                                                                                                                 Ass3_Given, Ass3_Max, Ass3_Status, Ass4_Given, Ass4_Max, Ass4_Status,
                                                                                                                                                                 Ass5_Given, Ass5_Max, Ass5_Status, Ass6_Given, Ass6_Max, Ass6_Status,
                                                                                                                                                                 Ass7_Given, Ass7_Max, Ass7_Status, Ass8_Given, Ass8_Max, Ass8_Status,
                                                                                                                                                                 Ass9_Given, Ass9_Max, Ass9_Status, Ass10_Given, Ass10_Max, Ass10_Status,
                                                                                                                                                                 Test1_Given, Test1_Max, Test1_Status, Test2_Given, Test2_Max, Test2_Status,
                                                                                                                                                                 Test3_Given, Test3_Max, Test3_Status, Test4_Given, Test4_Max, Test4_Status,
                                    Test5_Given, Test5_Max, Test5_Status, Test6_Given, Test6_Max, Test6_Status,Test7_Given, Test7_Max, Test7_Status, Test8_Given, Test8_Max, Test8_Status,Test9_Given, Test9_Max, Test9_Status, Test10_Given, Test10_Max, Test10_Status,Ass_Percent,Test_Percent,Final1_Given,Final1_Max,           Final1_Status,Final2_Given,Final2_Max,Final2_Status,Final3_Given,Final3_Max,Final3_Status,Final_Percent,Discipline , Final_Result_Percent , Grade`;

                // Combine both assignment and test data into the same query values array
                const queryValues = [
                    assignmentData.Ass1_Given,
                    assignmentData.Ass1_Max,
                    assignmentData.Ass1_Status,
                    assignmentData.Ass2_Given,
                    assignmentData.Ass2_Max,
                    assignmentData.Ass2_Status,
                    assignmentData.Ass3_Given,
                    assignmentData.Ass3_Max,
                    assignmentData.Ass3_Status,
                    assignmentData.Ass4_Given,
                    assignmentData.Ass4_Max,
                    assignmentData.Ass4_Status,
                    assignmentData.Ass5_Given,
                    assignmentData.Ass5_Max,
                    assignmentData.Ass5_Status,
                    assignmentData.Ass6_Given,
                    assignmentData.Ass6_Max,
                    assignmentData.Ass6_Status,
                    assignmentData.Ass7_Given,
                    assignmentData.Ass7_Max,
                    assignmentData.Ass7_Status,
                    assignmentData.Ass8_Given,
                    assignmentData.Ass8_Max,
                    assignmentData.Ass8_Status,
                    assignmentData.Ass9_Given,
                    assignmentData.Ass9_Max,
                    assignmentData.Ass9_Status,
                    assignmentData.Ass10_Given,
                    assignmentData.Ass10_Max,
                    assignmentData.Ass10_Status,
                    testData.Test1_Given,
                    testData.Test1_Max,
                    testData.Test1_Status,
                    testData.Test2_Given,
                    testData.Test2_Max,
                    testData.Test2_Status,
                    testData.Test3_Given,
                    testData.Test3_Max,
                    testData.Test3_Status,
                    testData.Test4_Given,
                    testData.Test4_Max,
                    testData.Test4_Status,
                    testData.Test5_Given,
                    testData.Test5_Max,
                    testData.Test5_Status,
                    testData.Test6_Given,
                    testData.Test6_Max,
                    testData.Test6_Status,
                    testData.Test7_Given,
                    testData.Test7_Max,
                    testData.Test7_Status,
                    testData.Test8_Given,
                    testData.Test8_Max,
                    testData.Test8_Status,
                    testData.Test9_Given,
                    testData.Test9_Max,
                    testData.Test9_Status,
                    testData.Test10_Given,
                    testData.Test10_Max,
                    testData.Test10_Status,
                    ass_avg,
                    test_avg,
                    FinalData.Final1_Given,
                    FinalData.Final1_Max,
                    FinalData.Final1_Status,
                    FinalData.Final2_Given,
                    FinalData.Final2_Max,
                    FinalData.Final2_Status,
                    FinalData.Final3_Given,
                    FinalData.Final3_Max,
                    FinalData.Final3_Status,
                    finalavg,
                    Viva_Marks,
                    finalpercentage,
                    Grade
                ];

                // Prepare insert query
                const insertQuery = `INSERT INTO generate_final_child (Gen_id, Batch_Id, Student_Code, Student_Name, ${queryFields}) VALUES (?, ?, ?, ?, ${queryValues.map(() => "?").join(", ")})`;

                return new Promise((resolve, reject) => {
                    con.query(
                        insertQuery,
                        [uid, batch, Student_Code, Student_Name, ...queryValues],
                        (err, childdata) => {
                            if (err) {
                                console.error("Error inserting data:", err);
                                return reject(err);
                            } else {
                                const childid = childdata.insertId;

                                const getattendetail =
                                    "SELECT COUNT(*) as total_lecture, SUM(CASE WHEN ltc.Student_Atten = 'Absent' THEN 1 ELSE 0 END) AS total_absent ,SUM(CASE WHEN ltc.Student_Atten = 'Present' THEN 1 ELSE 0 END) AS total_present ,ROUND(SUM(CASE WHEN ltc.Student_Atten = 'Present' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as atten_per FROM`lecture_taken_master` as ltm LEFT JOIN Lecture_taken_child as ltc on ltc.Take_Id = ltm.Take_Id WHERE ltc.Student_Id = ? and ltm.Batch_Id = ? and ltm.IsDelete = 0";

                                con.query(getattendetail, [Student_Id, batch], (err, data) => {
                                    if (err) {
                                        return reject(err);
                                    } else {

                                        const Total_Lectures = data[0].total_lecture;
                                        const AttenLectures = data[0].total_present;
                                        const Absents = data[0].total_absent;
                                        const Atten_Per = data[0].atten_per;

                                        const updateattend =
                                            "update `generate_final_child` set Total_Lectures = ?,Full_Attendance = ?,Full_Attend =?,Absents = ?,AttenLectures = ? where id = ?";

                                        con.query(
                                            updateattend,
                                            [
                                                Total_Lectures,
                                                Atten_Per,
                                                Atten_Per,
                                                Absents,
                                                AttenLectures,
                                                childid,
                                            ],
                                            (err, data) => {
                                                if (err) {
                                                    return reject(err);
                                                } else {
                                                    const getassigndetails =
                                                        "SELECT COUNT(*) as total_assignment,SUM(CASE WHEN agc.Status = 'Present' THEN 1 ELSE 0 END) AS total_given FROM Assignment_taken as atn LEFT join Assignment_given_child as agc on agc.Given_Id = atn.Given_Id WHERE  atn.Batch_Id = ? AND agc.Student_Id = ? AND atn.IsDelete = 0";

                                                    con.query(
                                                        getassigndetails,
                                                        [batch, Student_Id],
                                                        (err, assigndata) => {
                                                            if (err) {
                                                                return reject(err);
                                                            } else {
                                                                const Total_assignment =
                                                                    assigndata[0].total_assignment;
                                                                const Total_given = assigndata[0].total_given;

                                                                const updateassign =
                                                                    "update `generate_final_child` set Total_Assignments =? ,Given_Assignments =? where id = ?";

                                                                con.query(
                                                                    updateassign,
                                                                    [Total_assignment, Total_given, childid],
                                                                    (err, data) => {
                                                                        if (err) {
                                                                            return reject(err);
                                                                        } else {
                                                                            const gettestdetails =
                                                                                "SELECT COUNT(*) as total_test,SUM(CASE WHEN ttc.Status = 'Present' THEN 1 ELSE 0 END) AS total_given FROM Test_taken_master as ttm LEFT join Test_taken_child as ttc on ttc.Take_Id = ttm.Take_Id WHERE  ttm.Batch_Id = ? AND ttc.Student_Id = ? AND ttm.IsDelete = 0";

                                                                            con.query(
                                                                                gettestdetails,
                                                                                [batch, Student_Id],
                                                                                (err, testdata) => {
                                                                                    if (err) {
                                                                                        return reject(err);
                                                                                    } else {
                                                                                        const Total_test =
                                                                                            testdata[0]
                                                                                                .total_test;
                                                                                        const Total_given =
                                                                                            testdata[0]
                                                                                                .total_given;

                                                                                        const updatetest =
                                                                                            "update `generate_final_child` set Total_Tests =? ,Given_Tests =? where id = ?";

                                                                                        con.query(
                                                                                            updatetest,
                                                                                            [
                                                                                                Total_test,
                                                                                                Total_given,
                                                                                                childid,
                                                                                            ],
                                                                                            (err, data) => {
                                                                                                if (err) return reject(err);
                                                                                                resolve("Inserted Successfully");
                                                                                            }
                                                                                        );
                                                                                    }
                                                                                }
                                                                            );
                                                                        }
                                                                    }
                                                                );
                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }
                                });
                            }
                        }
                    );
                });
            });

            return Promise.all(insertions);
        };

        const assignmentQuery = `SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, atn.Assign_No, agc.Marks_Given, atn.Marks, agc.Status
        FROM Admission_master as am 
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN Assignment_given_child as agc ON agc.Student_Id = sm.Student_Id 
        LEFT JOIN Assignment_taken as atn ON atn.Given_Id = agc.Given_Id 
        WHERE atn.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0 AND am.isDelete = 0 AND agc.isDelete = 0 and atn.IsDelete = 0
      `;

        const testQuery = `
        SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, ttm.Test_No, ttc.Marks_Given as Test_Marks_Given, ttm.Marks as Test_Marks, ttc.Status as Test_Status
        FROM Admission_master as am  
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN Test_taken_child as ttc ON ttc.Student_Id = sm.Student_Id AND ttc.isDelete = 0
        LEFT JOIN Test_taken_master as ttm ON ttm.Take_Id = ttc.Take_Id AND ttm.isDelete = 0
        WHERE ttm.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0
      `;

        const finalQuery = `
        SELECT sm.Student_Id, am.Student_Code, sm.Student_Name, fem.Test_No as Final_test_No, etc.Marks_Given as Final_Mark_Given, fem.Marks as Final_Marks, etc.Status as Final_Status
        FROM Admission_master as am
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN Exam_taken_child as etc ON etc.Student_Id = sm.Student_Id AND etc.isDelete = 0
        LEFT JOIN Final_exam_master as fem ON fem.Take_Id = etc.Take_Id AND fem.isDelete = 0
        WHERE fem.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0
      `;


        const vivaquery = `SELECT sm.Student_Id, am.Student_Code, sm.Student_Name,  sm.Student_Id,vtc.Marks_Given as Viva_Marks
        FROM Admission_master as am
        LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN viva_taken_child as vtc ON vtc.Student_Id = sm.Student_Id AND vtc.isDelete = 0
        LEFT JOIN viva_taken as vt ON vt.Take_Id = vtc.Take_Id AND vt.isDelete = 0
        WHERE vt.Batch_Id = ? AND sm.Status_Id = 8 AND sm.isDelete = 0`

        const getgrade = `SELECT start_from, end_from, grade FROM grades WHERE batch_id = ?`

        const [assignmentData, testData, finalData, vivadata, gradeData] = await Promise.all([
            queryPromise(assignmentQuery, [batch]),
            queryPromise(testQuery, [batch]),
            queryPromise(finalQuery, [batch]),
            queryPromise(vivaquery, [batch]),
            queryPromise(getgrade, [batch]),
        ]);


        const combinedData = {};

        function calculateGrade(score, gradeList) {
            for (let i = 0; i < gradeList.length; i++) {
                const { start_from, end_from, grade } = gradeList[i];
                if (score >= start_from && score <= end_from) {
                    return grade;
                }
            }
            return 'NA'; // Fallback
        }

        // Process assignments
        assignmentData.forEach((row) => {
            const {
                Student_Id = "",
                Student_Code = "",
                Student_Name = "",
                Assign_No = "",
                Marks_Given = 0,
                Marks = 0,
                Status = ""
            } = row;

            if (!combinedData[Student_Id]) {
                combinedData[Student_Id] = {
                    Student_Id,
                    Student_Code,
                    Student_Name,
                    assignmentData: {},
                    testData: {},
                    FinalData: {},
                    Viva_Marks: 0,
                };
            }

            combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Given`] = Marks_Given;
            combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Max`] = Marks || 0;
            combinedData[Student_Id].assignmentData[`Ass${Assign_No}_Status`] = Status;
        });

        // Process tests
        testData.forEach((row) => {
            const {
                Student_Id = "",
                Student_Code = "",
                Student_Name = "",
                Test_No = "",
                Test_Marks_Given = 0,
                Test_Marks = 0,
                Test_Status = ""
            } = row;

            if (!combinedData[Student_Id]) {
                combinedData[Student_Id] = {
                    Student_Id,
                    Student_Code,
                    Student_Name,
                    assignmentData: {},
                    testData: {},
                    FinalData: {},
                    Viva_Marks: 0,
                };
            } else {
                // Ensure student name/code is filled if missing
                if (!combinedData[Student_Id].Student_Code) combinedData[Student_Id].Student_Code = Student_Code;
                if (!combinedData[Student_Id].Student_Name) combinedData[Student_Id].Student_Name = Student_Name;
            }

            combinedData[Student_Id].testData[`Test${Test_No}_Given`] = Test_Marks_Given;
            combinedData[Student_Id].testData[`Test${Test_No}_Max`] = Test_Marks || 0;
            combinedData[Student_Id].testData[`Test${Test_No}_Status`] = Test_Status;
        });

        finalData.forEach((row) => {
            const {
                Student_Id = "",
                Student_Code = "",
                Student_Name = "",
                Final_test_No = "",
                Final_Mark_Given = 0,
                Final_Marks = 0,
                Final_Status = "",
            } = row;

            if (!combinedData[Student_Id]) {
                combinedData[Student_Id] = {
                    Student_Id,
                    Student_Code: "",
                    Student_Name: "",
                    assignmentData: {},
                    testData: {},
                    FinalData: {},
                    Viva_Marks: 0,
                };
            } else {
                // Ensure student name/code is filled if missing
                if (!combinedData[Student_Id].Student_Code) combinedData[Student_Id].Student_Code = Student_Code;
                if (!combinedData[Student_Id].Student_Name) combinedData[Student_Id].Student_Name = Student_Name;
            }

            combinedData[Student_Id].FinalData[`Final${Final_test_No}_Given`] = Final_Mark_Given;
            combinedData[Student_Id].FinalData[`Final${Final_test_No}_Max`] = Final_Marks || 0;
            combinedData[Student_Id].FinalData[`Final${Final_test_No}_Status`] = Final_Status;
        });

        vivadata.forEach((row) => {
            const {
                Student_Id = "",
                Viva_Marks = 0
            } = row;

            if (!combinedData[Student_Id]) {
                combinedData[Student_Id] = {
                    Student_Id,
                    Student_Code: "",
                    Student_Name: "",
                    assignmentData: {},
                    testData: {},
                    FinalData: {},
                    Viva_Marks: 0,
                };
            } else {
                // Ensure student name/code is filled if missing
                if (!combinedData[Student_Id].Student_Code) combinedData[Student_Id].Student_Code = Student_Code;
                if (!combinedData[Student_Id].Student_Name) combinedData[Student_Id].Student_Name = Student_Name;
            }

            combinedData[Student_Id].Viva_Marks = Viva_Marks || 0;
        });




        // Calculate Averages
        Object.keys(combinedData).forEach((studentId) => {
            const student = combinedData[studentId];

            // Assignment Avg (Max 15 marks)
            let assignGiven = 0,
                assignMax = 0;
            Object.keys(student.assignmentData || {}).forEach((key) => {
                if (key.includes('_Given')) {
                    const index = key.split('_')[0]; // e.g., "Ass1"
                    const g = student.assignmentData[`${index}_Given`] || 0;
                    const m = student.assignmentData[`${index}_Max`] || 0;

                    assignGiven += g;
                    assignMax += m;

                }
            });
            student.assignmentAverage = assignMax > 0 ? (assignGiven / assignMax) * 15 : 0;

            // Test Avg (Max 35 marks)
            let testGiven = 0,
                testMax = 0;
            Object.keys(student.testData || {}).forEach((key) => {
                if (key.includes('_Given')) {
                    const index = key.split('_')[0]; // e.g., "Test1"
                    const g = student.testData[`${index}_Given`] || 0;
                    const m = student.testData[`${index}_Max`] || 0;

                    testGiven += g;
                    testMax += m;

                }
            });
            student.testAverage = testMax > 0 ? (testGiven / testMax) * 35 : 0;

            // Final Avg (Max 50 marks)
            let finalGiven = 0,
                finalMax = 0;
            Object.keys(student.FinalData || {}).forEach((key) => {
                if (key.includes('_Given')) {
                    const index = key.split('_')[0]; // e.g., "Final1"
                    const g = Number(student.FinalData[`${index}_Given`] || 0);
                    const m = Number(student.FinalData[`${index}_Max`] || 0);



                    finalGiven += g;
                    finalMax += m;

                }
            });
            student.Final_Avg = finalMax > 0 ? (finalGiven / finalMax) * 50 : 0;

            // Convert negative Viva_Marks (e.g., -10) into positive deduction
            const vivaDeduction = Math.abs(student.Viva_Marks || 0);

            // Store the raw viva deduction (optional for display/debug)
            student.Viva_Avg = vivaDeduction;

            // Compute total after deducting viva marks (treated as penalty in %)
            const total = Math.max(0,
                student.assignmentAverage +
                student.testAverage +
                student.Final_Avg -
                vivaDeduction
            );

            // Store total percentage and grade
            student.TotalPercentage = total.toFixed(2);
            student.Grade = calculateGrade(total, gradeData);
        });

        // Insert all students' processed data
        await insertData(combinedData);


        res.json("Data Updated");




    } catch (err) {
        console.error("Error in add_generateresult:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }


});





app.post("/nodeapp/add_facultyworking", (req, res) => {
    let { date, course, batch, faculty, facultytime, to, work, uid } = req.body;


    let fromtime = new Date(`1970-01-01T${facultytime}:00`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).replace(":", ".").replace(" ", "");

    let totime = new Date(`1970-01-01T${to}:00`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).replace(":", ".").replace(" ", "");



    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql =
            "insert into awt_facultyworking(`date`,`course`,`batch`,`faculty`,`facultytime`,`to`,`work`) values(?,?,?,?,?,?,?)";

        param = [date, course, batch, faculty, fromtime, totime, work];
    } else {
        sql =
            "update `awt_facultyworking` set `date` =? , `course` =? , `batch` =? , `faculty` =? , `facultytime` =? , `to` =? , `work` =? where id = ?";

        param = [date, course, batch, faculty, fromtime, totime, work, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/get_vistsite", (req, res) => {
    const sql = "select * from Site_visit_master where isDelete = 0;";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/get_workingtime", (req, res) => {
    const sql =
        "SELECT fw.id , bm.Batch_code ,fw.batch, cm.Course_Name , fw.course ,date , fm.Faculty_Name as faculty ,fw.facultytime,fw.to,fw.work FROM awt_facultyworking as fw left join Batch_Mst as bm on fw.batch = bm.Batch_Id left join Course_Mst as cm on fw.course = cm.Course_Id left JOIN faculty_master as fm on fm.Faculty_Id = fw.faculty where fw.deleted = 0 order by date desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/batch_site_vise", (req, res) => {
    let { batch_id } = req.body;

    const sql = "select * from awt_batch_side_visit where deleted = 0 and batch_id = ? ";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/batch_exam_data", (req, res) => {
    let { batch_id } = req.body;

    const sql = "select * from awt_batch_exam where deleted = 0 and batch_id = ? ";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_visitsite", (req, res) => {
    // add regin input changes the db ~ bhavesh

    let { course, batch, location, student, date, time, region, confirmdate, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql =
            "insert into Site_visit_master(`Course_Name`,`Batch_Code`,`Location`,`Total_Student`,`Visit_Date`,`Visit_Time`,`Region`,`ConfirmDAte`) values(?,?,?,?,?,?,?,?)";

        param = [course, batch, location, student, date, time, region, confirmdate];
    } else {
        sql =
            "update `Site_visit_master` set `Course_Name` =? , `Batch_Code` =? , `Location` =? , `Total_Student` =? , `Visit_Date` =? , `Visit_Time` =? , `ConfirmDAte` =? `Region`=? where Visit_Id = ?";

        param = [course, batch, location, student, date, time, confirmdate, region, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_feedback1", (req, res) => {
    let { course, batch, student, date, feedback, srno, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into feedback1(`course`,`batch`,`student`,`date`,`feedback`,`srno`) values(?,?,?,?,?,?)";

        param = [course, batch, student, date, feedback, srno];
    } else {
        sql =
            "update `feedback1` set `course` =? , `batch` =? , `student` =? , `date` =? , `feedback` =? , `srno` =? where id = ?";

        param = [course, batch, student, date, feedback, srno, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_onlinestudent", (req, res) => {
    let { course, admission, fromdate, todate, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into awt_onlinestudent(`course`,`admission`,`fromdate`,`todate`) values(?,?,?,?)";

        param = [course, admission, fromdate, todate];
    } else {
        sql = "update `awt_onlinestudent` set `course` =? , `admission` =? , `fromdate` =? , `todate` =? where id = ?";

        param = [course, admission, fromdate, todate, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_sitevisit", (req, res) => {
    let { course, batch, site, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into awt_sitevisit(`course`,`batch`,`site`) values(?,?,?)";

        param = [course, batch, site];
    } else {
        sql = "update `awt_sitevisit` set `course` =? , `batch` =? , `site` =? where id = ?";

        param = [course, batch, site, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_employerecord", (req, res) => {
    let { training, attendee, instructor, description, feedback, u_id } = req.body;

    let sql;
    let param;

    console.log(u_id);

    if (u_id === undefined || u_id === null || u_id === "") {
        sql = `
            INSERT INTO awt_employerecord
            (training, attendee, instructor, description, feedback)
            VALUES (?, ?, ?, ?, ?)
        `;
        param = [training, attendee, instructor, description, feedback];
    } else {
        sql = `
            UPDATE awt_employerecord
            SET training = ?, attendee = ?, instructor = ?, description = ?, feedback = ?
            WHERE id = ?
        `;
        param = [training, attendee, instructor, description, feedback, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json({ error: err.message });
        } else {
            // Send consistent JSON object back to frontend
            if (u_id === undefined || u_id === null || u_id === "") {
                return res.json({
                    message: "Data Inserted",
                    // id: data.insertId,  
                });
            } else {
                return res.json({
                    message: "Data Updated",
                    id: u_id, // Return updated ID
                });
            }
        }
    });
});


app.post("/nodeapp/add_studentbatch", (req, res) => {
    let { course, batch, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into awt_studentbatch(`course`,`batch`) values(?,?)";

        param = [course, batch];
    } else {
        sql = "update `awt_studentbatch` set `training` =? , `course` =? , `batch` =? where id = ?";

        param = [course, batch, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_noticeboard", (req, res) => {
    let { startdate, enddate, specification, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into awt_noticeboard(`startdate`,`enddate`,`specification`) values(?,?,?)";

        param = [startdate, enddate, specification];
    } else {
        sql = "update `awt_noticeboard` set `startdate` =? , `enddate` =? , `specification` =? where id = ?";

        param = [startdate, enddate, specification, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_viewstudent", (req, res) => {
    let { course, batch, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql = "insert into viewstudent(`course`,`batch`) values (?,?)";
        param = [course, batch];
    } else {
        sql = "update `viewstudent` set `course` =? , `batch` =? where id =?";
        param = [course, batch, uid];
    }
    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_awt_emailmaster", (req, res) => {
    let { emailpurpose, department, emailsubject, cc, bcc, specification, uid } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid == undefined) {
        sql =
            "insert into awt_emailmaster(`emailpurpose`,`department`,`emailsubject`,`cc`,`bcc`,`specification`) values(?,?,?,?,?,?)";

        param = [emailpurpose, department, emailsubject, cc, bcc, specification];
    } else {
        sql =
            "update `awt_emailmaster` set `emailpurpose` =? , `department` =? , `emailsubject` =? , `cc` =? , `bcc` =? , `specification` =? where id = ?";

        param = [emailpurpose, department, emailsubject, cc, bcc, specification, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

// ================================Accounts Masters

app.get("/nodeapp/get_assets", (req, res) => {
    const sql =
        "select aa.id, avm.vendorname,aa.startdate,aa.quantity,aa.price,lm.LocationMaster,aac.title from awt_assets as aa left join awt_vendor_master as avm on aa.venderid = avm.id LEFT JOIN Location_master as lm on lm.id = aa.locationid LEFT JOIN awt_asset_category as aac on aac.id = aa.assetsid where aa.deleted = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_assets", (req, res) => {
    let { startdate, vendorname, assets, quantity, price, location, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into awt_assets(`startdate`,`venderid`,`assetsid`,`quantity`,`price`,`locationid`) values(?,?,?,?,?,?)";

        param = [startdate, vendorname, assets, quantity, price, location];
    } else {
        sql =
            "update `awt_assets` set `startdate` =? , `venderid` =? , `assetsid` =? , `quantity` =? , `price` =? , `locationid` =? where id = ?";

        param = [startdate, vendorname, assets, quantity, price, location, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_awt_batchtransfer", (req, res) => {
    let { coursename, oldbatchno, student, newbatch, transferammount, paymenttype, uid } = req.body;

    let checkSql = "SELECT * FROM awt_batchtransfer WHERE student = ? and deleted = 0";
    let checkParams = [student];

    con.query(checkSql, checkParams, (checkErr, checkResult) => {
        if (checkErr) {
            return res.json({ success: false, message: "Error checking for duplicate student", error: checkErr });
        }

        // In INSERT mode (no uid), check if student already exists
        if (!uid && checkResult.length > 0) {
            return res.json({ success: false, message: "Student already exists in transfer list" });
        }

        // In UPDATE mode (uid present), check if the same student exists in another record
        if (uid && checkResult.length > 0 && checkResult[0].id != uid) {
            return res.json({ success: false, message: "Student already exists in another transfer record" });
        }

        let sql, param;

        if (uid == undefined) {
            sql = `
                INSERT INTO awt_batchtransfer 
                (coursename, oldbatch_code, student, trans_batchcode, transferammount, paymenttype)
                VALUES (?, ?, ?, ?, ?, ?)`;
            param = [coursename, oldbatchno, student, newbatch, transferammount, paymenttype];


        } else {
            sql = `
                UPDATE awt_batchtransfer 
                SET coursename = ?, oldbatch_code = ?, student = ?, trans_batchcode = ?, transferammount = ?, paymenttype = ?
                WHERE id = ?`;
            param = [coursename, oldbatchno, student, newbatch, transferammount, paymenttype, uid];
        }

        con.query(sql, param, (err, data) => {
            if (err) {
                return res.json({ success: false, message: "Database error", error: err });


            } else {

                const current_date = new Date();

                const formatDate = current_date.toISOString().slice(0, 10);


                if (data.insertId) {
                    const insertintoAdmission = `
        INSERT INTO Admission_master (
            Batch_Id,
            Admission_Date,
            Course_Id,
            Student_Id,
            Payment_Type,
            Amount,
            Transfered,
            IsDelete
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

                    const insertParams = [newbatch, formatDate, coursename, student, paymenttype, transferammount, 'No', '0'];

                    con.query(insertintoAdmission, insertParams, (err, admissionData) => {
                        if (err) {
                            return res.json({ success: false, message: "Error inserting into Admission", error: err });
                        } else {
                            // ✅ Now update the old Admission row
                            const updateOldAdmission = `
                UPDATE Admission_master 
                SET Transfered = 'Yes'
                WHERE Student_Id = ? 
                AND Batch_Id = ? 
                AND IsDelete = 0
                ORDER BY Admission_Id DESC
                LIMIT 1`;

                            con.query(updateOldAdmission, [student, oldbatchno], (updateErr, updateRes) => {
                                if (updateErr) {
                                    return res.json({ success: false, message: "Error updating old Admission", error: updateErr });
                                } else {
                                    return res.json({ success: true, message: "Inserted and updated admission successfully", data: { id: data.insertId } });
                                }
                            });
                        }
                    });
                }


                // return res.json({ success: true, message: uid ? "Updated successfully" : "Inserted successfully", data });
            }
        });
    });
});

app.get("/nodeapp/getbatch_transfer", (req, res) => {
    const sql =
        "SELECT abt.id ,bm.Batch_code as oldbatch_code  ,bmt.Batch_code as trans_batchcode,abt.transferammount,abt.paymenttype ,sm.Student_Name ,abt.created_date FROM `awt_batchtransfer` as abt LEFT JOIN Course_Mst as cm on cm.Course_Id = abt.coursename left JOIN Student_Master as sm on sm.Student_Id = abt.student LEFT JOIN Batch_Mst as bm on bm.Batch_Id = abt.oldbatch_code LEFT JOIN Batch_Mst as bmt on bmt.Batch_Id = abt.trans_batchcode  WHERE abt.deleted = 0 order by abt.id desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_sit_batchcancellation", (req, res) => {
    let { course, batchno, student, cancellationammount, date, uid } = req.body;

    let sql;
    let param;
    // console.log(uid)
    if (uid == undefined) {
        sql =
            "insert into awt_batchcancellation(`course`, `batchno`, `student`, `cancellationammount`, `date`) values(?,?,?,?,?)";

        param = [course, batchno, student, cancellationammount, date];
    } else {
        sql =
            "update `awt_batchcancellation` set `course` = ? , `batchno` = ? , `student` = ? , `cancellationammount` = ? , `date` = ? where id = ?";

        param = [course, batchno, student, cancellationammount, date, uid];
    }
    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

// app.post('/nodeapp/getsit_batchcancellation', (req, res) => {

//   const sql = "select * from `sit_batchcancellation`"

//   con.query(sql, (err, data) => {
//     if (err) {
//       return res.json(err)
//     } else {
//       return res.json(data)
//     }
//   })
// })

app.post("/nodeapp/add_material_consumption", (req, res) => {
    let {
        faculty,
        startdate,
        course,
        qtyinstock,
        batchno,
        student,
        selectitem,
        qtyissue,
        price,
        ammounts,
        purpose,
        uid,
    } = req.body;

    const date = new Date();

    let sql;
    let param;

    // console.log(uid)

    if (uid == undefined) {
        sql =
            "insert into awt_materialconsumption(`isusseby`,	`startdate`,	`course`,	`qtyinstock`,	`batchno`,	`student`,	`selectitem`,	`qtyissue`,	`price`,	`ammounts`,	`purpose`,`created_date`) values(?,?,?,?,?,?,?,?,?,?,?,?)";

        param = [
            faculty,
            startdate,
            course,
            qtyinstock,
            batchno,
            student,
            selectitem,
            qtyissue,
            price,
            ammounts,
            purpose,
            date,
        ];
    } else {
        sql =
            "update `awt_materialconsumption` set `isusseby` =? ,	`startdate` =? ,	`course` =? ,	`qtyinstock` =? ,	`batchno` =? , `student` =? ,	`selectitem` =? ,	`qtyissue` =? ,	`price` =? ,	`ammounts` =? ,	`purpose` =? , `updated_date` = ? where id = ?";

        param = [
            faculty,
            startdate,
            course,
            qtyinstock,
            batchno,
            student,
            selectitem,
            qtyissue,
            price,
            ammounts,
            purpose,
            date,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getmaterialconsumption", (req, res) => {
    const sql =
        "select am.id,am.startdate,am.qtyinstock,am.qtyissue,am.price,am.ammounts,am.purpose,fm.Faculty_Name,cm.Course_Name,sm.Student_Name,amc.Category,am.batchno from awt_materialconsumption as am LEFT JOIN faculty_master as fm on fm.Faculty_Id = am.isusseby LEFT join Course_Mst as cm on cm.Course_Id = am.course LEFT JOIN Student_Master as sm on sm.Student_Id = am.student LEFT JOIN awt_material_cat as amc on amc.id = am.selectitem WHERE am.deleted = 0";

    con.query(sql, (err, data) => {
        if (err) {
            console.error("Error executing query: ", err);
            return res.status(500).json({ error: "Database query failed" });
        }
        return res.status(200).json(data);
    });
});

app.post("/nodeapp/add_awt_salarymaster", (req, res) => {
    let { formdate, todate, service, empcontri, salaryda, minbasic, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into awt_salarymaster(`formdate`,`todate`,`service`,`empcontri`,`salaryda`,`minbasic`) values(?,?,?,?,?,?)";

        param = [formdate, todate, service, empcontri, salaryda, minbasic];
    } else {
        sql =
            "update `awt_salarymaster` set `formdate` =? , `todate` =? , `service` =? , `empcontri` =? , `salaryda` =? , `minbasic` =? where id = ?";

        param = [formdate, todate, service, empcontri, salaryda, minbasic, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            if (data.insertId > 0) {

                return res.json("Data Inserted Successfully");
            } else {

                return res.json("Data Updated Successfully");
            }
        }
    });
});

app.post("/nodeapp/add_batchleft", (req, res) => {
    let { course, batchno, student, date, reason, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into awt_batchleft(`course`,`batchno`,`student`,`date`,`reason`) values(?,?,?,?,?)";

        param = [course, batchno, student, date, reason];
    } else {
        sql =
            "update `awt_batchleft` set `course` =? , `batchno` =? , `student` =? , `date` =? , `reason` =? where id = ?";

        param = [course, batchno, student, date, reason, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getstatus", (req, res) => {
    const sql = "select * from Status_Master where IsDelete = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getfaculty_masterdata", (req, res) => {
    const sql = "select * from faculty_master where  IsDelete = 0 order by Faculty_Name asc";


    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});



app.post("/nodeapp/getfaculty_acadamic_records", (req, res) => {
    const { facultyid } = req.body;

    const sql = "SELECT * FROM Faculty_Acadamic_Record WHERE faculty_id = ?";

    con.query(sql, [facultyid], (err, data) => {  // <- FIXED: Added [facultyid]
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/get_faculty_discussion", (req, res) => {
    const { facultyid } = req.body;

    const sql = "SELECT * FROM Faculty_Discussion WHERE Faculty_Id = ?";

    con.query(sql, [facultyid], (err, data) => {  // <- FIXED: Added [facultyid]
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/save_faculty_discussion", (req, res) => {
    const { facultyid, records } = req.body;

    if (!facultyid || !Array.isArray(records) || records.length === 0) {
        return res.json({ success: false, message: "Invalid request data" });
    }

    const checkSql = "SELECT * FROM Faculty_Discussion WHERE Faculty_Id = ?";
    con.query(checkSql, [facultyid], (err, result) => {
        if (err) return res.json({ success: false, error: err });

        // If record exists, delete all old ones (or update one by one)
        const deleteSql = "DELETE FROM Faculty_Acadamic_Record WHERE faculty_id = ?";
        con.query(deleteSql, [facultyid], (err, deleteResult) => {
            if (err) return res.json({ success: false, error: err });

            const insertSql = `
                INSERT INTO Faculty_Discussion (Faculty_Id, Dis_date, Remark, Department)
                VALUES ?
            `;

            const values = records.map(row => [
                facultyid,
                row.discussiondate,
                row.remark,
                row.department,

            ]);

            con.query(insertSql, [values], (err, insertResult) => {
                if (err) return res.json({ success: false, error: err });
                return res.json({ success: true, message: "Records saved" });
            });
        });
    });
});





app.post("/nodeapp/save_or_update_faculty_academic_qualification", (req, res) => {
    const { facultyid, records } = req.body;

    if (!facultyid || !Array.isArray(records) || records.length === 0) {
        return res.json({ success: false, message: "Invalid request data" });
    }

    const checkSql = "SELECT * FROM Faculty_Acadamic_Record WHERE faculty_id = ?";
    con.query(checkSql, [facultyid], (err, result) => {
        if (err) return res.json({ success: false, error: err });

        // If record exists, delete all old ones (or update one by one)
        const deleteSql = "DELETE FROM Faculty_Acadamic_Record WHERE faculty_id = ?";
        con.query(deleteSql, [facultyid], (err, deleteResult) => {
            if (err) return res.json({ success: false, error: err });

            const insertSql = `
                INSERT INTO Faculty_Acadamic_Record (faculty_id, Aca_Qualification, Institute, Year, Grade)
                VALUES ?
            `;

            const values = records.map(row => [
                facultyid,
                row.Aca_Qualification,
                row.Institute,
                row.Year,
                row.Grade
            ]);

            con.query(insertSql, [values], (err, insertResult) => {
                if (err) return res.json({ success: false, error: err });
                return res.json({ success: true, message: "Records saved" });
            });
        });
    });
});







app.get("/nodeapp/getcategory", (req, res) => {
    const sql = "select * from awt_material_cat where deleted = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getbatch", (req, res) => {
    const sql = "select Batch_Id, Batch_code from Batch_Mst where isDelete = 0 order by Batch_Id desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getqualification", (req, res) => {
    const sql = "select * from sit_qualification where deleted = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getACQualification", (req, res) => {
    let Student_id = req.body.Student_id;

    const sql =
        "select acd.* , aq.Education as Qualification_title , sd.Deciplin as Descipline_title ,ac.college_name as College_title from awt_academicqualification as acd left join MST_Education as aq on acd.Qualification = aq.Id left join MST_Deciplin as sd on acd.Discipline = sd.id left join awt_college as ac on ac.id = acd.College where acd.Student_id = ? and acd.deleted = 0";

    con.query(sql, [Student_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/addorderid", (req, res) => {
    let user_id = req.body.user_id;
    let orderid = req.body.orderid;

    const updateuserid = "update `order` set userid = ? where id = ?";

    con.query(updateuserid, [user_id, orderid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            if (data) {
                const sql =
                    "select id from `order` where `userid` = ? and `ostatus` = 'incart' order by `id` desc limit 1";

                con.query(sql, [user_id], (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        return res.json(data);
                    }
                });
            }
        }
    });
});

app.get("/nodeapp/role_data", (req, res) => {
    const sql = "select * from role where role.delete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/role_update", (req, res) => {
    let u_id = req.body.u_id;

    const sql = "select * from role where id = ?";

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/role_delete", (req, res) => {
    let role_id = req.body.role_id;

    const sql = "update role set role.delete = 1 where id = ?";

    con.query(sql, [role_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_role", (req, res) => {
    let user_id = req.body.user_id;
    let title = req.body.title;
    let description = req.body.description;
    let created_date = new Date();
    let u_id = req.body.u_id;

    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into role(`title`,`description`,`created_by`,`created_date`) values(?,?,?,?)";
        param = [title, description, user_id, created_date];
    } else {
        sql = "update role set title = ? , description = ? , updated_by = ? ,updated_date = ? where id = ? ";
        param = [title, description, user_id, created_date, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.post("/nodeapp/role_pages", (req, res) => {
    let role_id = req.body.role_id;

    const sqlSelect =
        "SELECT * FROM `pagerole` AS pg LEFT JOIN `page_master` AS pm ON pg.pageid = pm.id  WHERE pg.roleid = ? ORDER BY pg.id ASC";

    con.query(sqlSelect, [role_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            if (data.length == 0) {
                const selectquery = "select COUNT(*) as count from `page_master` where deleted = 0";

                con.query(selectquery, (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        const count = data[0].count;

                        // Insert 35 rows if data length is less than 0
                        const insertRows = "INSERT INTO `pagerole` (`roleid`, `pageid`,`accessid`) VALUES ?";

                        let values = [];
                        for (let i = 1; i < count; i++) {
                            // Assuming `roleid` and `pageid` are the columns in `pagerole` table
                            values.push([role_id, i, 1]);
                        }
                        con.query(insertRows, [values], (insertErr, insertResult) => {
                            if (insertErr) {
                                return res.json(insertErr);
                            } else {
                                const getdata =
                                    "SELECT * FROM `pagerole` AS pg LEFT JOIN `page_master` AS pm ON pg.pageid = pm.id  WHERE pg.roleid = ? ORDER BY pg.id ASC";

                                con.query(getdata, [role_id], (err, data) => {
                                    if (err) {
                                        return res.json(err);
                                    } else {
                                        return res.json(data);
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                return res.json(data);
            }
        }
    });
});

app.post("/nodeapp/assign_role", (req, res) => {
    let rolePages = req.body;

    const role_id = rolePages[0].roleid;

    const sql = "delete from `pagerole` where roleid = ?";

    con.query(sql, [role_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            const sql = "insert into pagerole(`roleid`,`pageid`,`accessid`) VALUES ?";
            const values = rolePages.map((rolePage) => [rolePage.roleid, rolePage.pageid, rolePage.accessid]);

            con.query(sql, [values], (err, data) => {
                if (err) {
                    return res.json(err);
                } else {
                    return res.json(data);
                }
            });
        }
    });
});

app.post("/nodeapp/getRoleData", (req, res) => {
    let role = req.body.role;
    let pageid = req.body.pageid;

    const sql = "select * from `pagerole` where pageid = ? and roleid = ?";

    con.query(sql, [pageid, role], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});



app.post("/nodeapp/delete_inquiry_data", (req, res) => {
    let cat_id = req.body.cat_id;
    let tablename = req.body.tablename;

    const sql = `update ${tablename} set IsDelete = 1 where Inquiry_Id = ?`;

    con.query(sql, [cat_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_adminuser", (req, res) => {
    let firstname = req.body.firstname;
    let lastname = req.body.lastname;
    let mobile = req.body.mobile;
    let email = req.body.email;
    let password = req.body.password;
    let created_date = new Date();
    let u_id = req.body.u_id;
    let user_id = req.body.user_id;
    let role = req.body.role;
    let address = req.body.address;
    let city = req.body.city;
    let state = req.body.state;
    let pincode = req.body.pincode;

    let sql;
    let param;

    if (u_id == undefined) {
        sql =
            "insert into awt_adminuser(`firstname`,`lastname`,`mobile`,`email`,`password`,`role`,`created_date`,`created_by`,`address`,`city`,`state`,`pincode`) values(?,?,?,?,?,?,?,?,?,?,?,?)";
        param = [
            firstname,
            lastname,
            mobile,
            email,
            password,
            role,
            created_date,
            user_id,
            address,
            city,
            state,
            pincode,
        ];
    } else {
        sql =
            "update awt_adminuser set firstname = ?, lastname = ?,mobile = ?, email = ?, password = ?, role = ?,updated_date = ?, updated_by = ? , address = ? , city = ? , state = ? ,pincode = ?  where id = ?";
        param = [
            firstname,
            lastname,
            mobile,
            email,
            password,
            role,
            created_date,
            user_id,
            address,
            city,
            state,
            pincode,
            u_id,
        ];
    }

    con.query(sql, param, (err, data) => {
        console.log(sql);
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.post("/nodeapp/adminuser_update", (req, res) => {
    let u_id = req.body.u_id;

    const sql = "select * from awt_adminuser where id = ?";

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/adminuser_data", (req, res) => {
    const sql = "select * from awt_adminuser where deleted = 0 order by id desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/adminuser_delete", (req, res) => {
    let adminuser_id = req.body.adminuser_id;
    let date = new Date();

    const sql = "update awt_adminuser set deleted = 1 , deleted_date = ? where id = ?";

    con.query(sql, [date, adminuser_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

// ******************Inquiry discussion

app.post("/nodeapp/inquirydiscuss_data", (req, res) => {
    let inquiryid = req.body.inquiryid;

    const sql = "select * from awt_inquirydiscussion where Inquiry_id = ? and deleted = 0 ";

    con.query(sql, [inquiryid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/inquirydiscuss_update", (req, res) => {
    let u_id = req.body.u_id;

    const sql = "select * from awt_inquirydiscussion where id = ?";

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/inquirydiscuss_delete", (req, res) => {
    let inquirydiscuss_id = req.body.inquirydiscuss_id;

    const sql = "update awt_inquirydiscussion set deleted = 1 where id = ?";

    con.query(sql, [inquirydiscuss_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_inquirydiscuss", (req, res) => {
    let user_id = req.body.user_id;
    let nextdate = req.body.nextdate;
    let date = req.body.date;
    let discussion = req.body.discussion;
    let created_date = new Date();
    let u_id = req.body.u_id;
    let inquiryid = req.body.inquiryid;

    let sql;
    let param;


    if (inquiryid == ':inquiryid') {

        const getinquiryid = "INSERT INTO Student_Inquiry (Student_Id , Inquiry_Dt) VALUES(? , ?)";


        con.query(getinquiryid, [null, date], (err, data) => {
            if (err) {

                return res.json(err)

            } else {
                const inquiry_id = data.insertId;

                const insertdata = "insert into awt_inquirydiscussion(`Inquiry_id`,`date`,`nextdate`,`discussion`,`created_by`,`created_date`) values(?,?,?,?,?,?)";

                con.query(insertdata, [inquiry_id, date, nextdate, discussion, user_id, created_date], (err, data) => {
                    if (err) {
                        return res.json(err)
                    } else {
                        return res.json({ message: "Data Submitted", inquiry_id: inquiry_id })
                    }
                })

            }
        })


    } else {


        if (u_id == undefined) {
            sql =
                "insert into awt_inquirydiscussion(`Inquiry_id`,`date`,`nextdate`,`discussion`,`created_by`,`created_date`) values(?,?,?,?,?,?)";
            param = [inquiryid, date, nextdate, discussion, user_id, created_date];
        } else {
            sql =
                "update awt_inquirydiscussion set date = ? , nextdate = ? , discussion = ?, updated_by = ? ,updated_date = ? where id = ? ";
            param = [date, nextdate, discussion, user_id, created_date, u_id];
        }

        con.query(sql, param, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                const updateinquiry = "update Student_Inquiry set Discussion = ? where Inquiry_Id = ?";

                con.query(updateinquiry, [discussion, inquiryid], (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        return res.json("Data Submitted");
                    }
                });
            }
        });

    }



});

// ******************oadmisiion discussion

app.post("/nodeapp/getadmissiondiscussion", (req, res) => {
    let admissionid = req.body.admissionid;

    // const sql = "select * from awt_inquirydiscussion where student_id = ? and deleted = 0 ";

    // con.query(sql, [admissionid], (err, data) => {
    //     if (err) {
    //         return res.json(err);
    //     } else {

    //         res.json(data)
    //     }
    // })


    const sqlInquiryId = "select Inquiry_Id from Student_Inquiry where Student_Id = ?";

    con.query(sqlInquiryId, [admissionid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            let sql = "select * from awt_inquirydiscussion where student_id = ? and deleted = 0 ";
            let params = [admissionid]

            if (data.length) {
                sql += " or Inquiry_id = ?"
                params.push(data[0].Inquiry_Id)
            }

            con.query(sql, params, (err, data) => {
                if (err) {
                    return res.json(err);
                } else {
                    return res.json(data);
                }
            });
        }
    });

});

app.post("/nodeapp/oadmissiondiscussion_update", (req, res) => {
    let u_id = req.body.u_id;

    const sql = "select * from awt_inquirydiscussion where id = ?";

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/oadmissiondiscuss_delete", (req, res) => {
    let discuss_id = req.body.discuss_id;

    const sql = "update awt_inquirydiscussion set deleted = 1 where id = ?";

    con.query(sql, [discuss_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_oadmissiondiscussion", (req, res) => {
    let user_id = req.body.user_id;
    let department = req.body.department;
    let date = req.body.date;
    let discussion = req.body.discussion;
    let created_date = new Date();
    let u_id = req.body.u_id;
    let admissionid = req.body.admissionid;

    let sql;
    let param;

    if (u_id == undefined) {
        sql =
            "insert into awt_inquirydiscussion(`student_id`,`date`,`department`,`discussion`,`created_by`,`created_date`) values(?,?,?,?,?,?)";
        param = [admissionid, date, department, discussion, user_id, created_date];
    } else {
        sql =
            "update awt_inquirydiscussion set date = ? , department = ? , discussion = ?, updated_by = ? ,updated_date = ? where id = ? ";
        param = [date, department, discussion, user_id, created_date, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.post("/nodeapp/updateAdmission", (req, res) => {
    let date = req.body.date;
    let roll = req.body.roll;
    let course = req.body.course;
    let batch = req.body.batch;
    let studentid = req.body.studentid;
    let ptype = req.body.ptype;
    let Amount = req.body.Amount;
    let Admitid = req.body.Admitid;

    const sql =
        "update Admission_master set Batch_Id = ? ,Admission_Date = ? , Course_Id = ? ,Student_Id = ? ,Payment_Type = ? ,Amount = ?,Student_Code = ?  where Admission_Id = ? ";

    con.query(sql, [batch, date, course, studentid, ptype, Amount, roll, Admitid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getannualbatch", (req, res) => {
    const today = new Date();
    const year = today.getFullYear();
    const isBeforeApril = today.getMonth() < 3; // Months are zero-based
    const startYear = isBeforeApril ? year - 1 : year;
    const endYear = isBeforeApril ? year : year + 1;

    // Format the dates as YYYY-MM-DD
    const fromDate = `${startYear}-04-01`;
    const toDate = `${endYear}-03-31`;



    const sql =
        "select bm.Batch_Id,bm.Admission_Date,bm.Course_Id,bm.Batch_code,bm.Category,bm.Timings,bm.SDate,bm.EDate,bm.Duration,bm.Training_Coordinator,cm.Course_Name from `Batch_Mst` as bm left join Course_Mst as cm on cm.Course_Id = bm.Course_Id where bm.IsDelete = 0 AND bm.SDate BETWEEN ? and ? order by bm.Course_Id asc;";

    con.query(sql, [fromDate, toDate], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getbatchlisting", (req, res) => {
    const sql =
        "select bm.Batch_Id,bm.Course_Id,bm.Batch_code,bm.Category,bm.Timings,bm.SDate,bm.EDate,bm.Duration,bm.Training_Coordinator,cm.Course_Name from `Batch_Mst` as bm left join Course_Mst as cm on cm.Course_Id = bm.Course_Id where bm.IsDelete = 0  order by bm.Course_Id asc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getCourse", (req, res) => {
    const sql =
        "select Course_Id,Course_Name,Introduction,Course_Code from `Course_Mst` where IsDelete = 0 order by Course_Name Asc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.get("/nodeapp/get_batchcategory", (req, res) => {
    const sql = "select id,BatchCategory from `MST_BatchCategory` where IsDelete = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_status", (req, res) => {
    let statusname = req.body.statusname;
    let description = req.body.description;
    let u_id = req.body.u_id;

    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into Status_Master(`Status`,`Description`) values(?,?)";
        param = [statusname, description];
    } else {
        sql = "update Status_Master set Status = ? , Description = ?  where Id = ? ";
        param = [statusname, description, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.get("/nodeapp/get_status", (req, res) => {
    const sql = "select id,Status,Description from `Status_Master` where IsDelete = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/Update_fees_structure", (req, res) => {
    let {
        basicinr,
        sevicetaxinr,
        totalinr,
        basicdoller,
        sevicetaxdoller,
        totaldoller,
        actualfees,
        fullfees,
        installment,
        duedate,
        pmode,
        beforedate,
        afterdate,
        uid,
    } = req.body;

    const check = "select * from Fees_Structure where batch_id = ?";

    con.query(check, [uid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            if (data.length == 0) {
                const sql =
                    "insert into Fees_Structure(`batch_id`,`basic_inr`,`servicetax_inr`,`total_inr`,`basic_doller`,`servicetax_doller`,`total_doller`,`actualfees`,`fullfees`,`installment`,`duedate`,`paymode`,`bdateamt`,`adateamt`) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

                con.query(
                    sql,
                    [
                        uid,
                        basicinr,
                        sevicetaxinr,
                        totalinr,
                        basicdoller,
                        sevicetaxdoller,
                        totaldoller,
                        actualfees,
                        fullfees,
                        installment,
                        duedate,
                        pmode,
                        beforedate,
                        afterdate,
                    ],
                    (err, data) => {
                        if (err) {
                            return res.json(err);
                        } else {
                            return res.json(1);
                        }
                    }
                );
            } else {
                const sql =
                    "update Fees_Structure set basic_inr =? ,servicetax_inr =? ,total_inr = ?,basic_doller =?,servicetax_doller =?, total_doller =? ,actualfees =?,fullfees=?,installment=?,duedate=?,paymode =?,bdateamt =?,adateamt=? where batch_id = ?";

                con.query(
                    sql,
                    [
                        basicinr,
                        sevicetaxinr,
                        totalinr,
                        basicdoller,
                        sevicetaxdoller,
                        totaldoller,
                        actualfees,
                        fullfees,
                        installment,
                        duedate,
                        pmode,
                        beforedate,
                        afterdate,
                        uid,
                    ],
                    (err, data) => {
                        if (err) {
                            return res.json(err);
                        } else {
                            return res.json(0);
                        }
                    }
                );
            }
        }
    });
});

app.put('/updateBatchFees', (req, res) => {
    const {
        basicinr,
        sevicetaxinr,
        totalinr,
        sevicetaxdoller,
        basicdoller,
        totaldoller,
        actualfees,
        fullfees,
        installment,
        batchid
    } = req.body;

    const query = `
        UPDATE Batch_Mst SET
            INR_Basic = ?,
            INR_ServiceTax = ?,
            INR_Total = ?,
            Dollar_ServiceTax = ?,
            Dollar_Basic = ?,
            Dollar_Total = ?,
            Actual_Fees_Payment = ?,
            Fees_Full_Payment = ?,
            Fees_Installment_Payment = ?
        WHERE batchid = ?
    `;

    const values = [
        basicinr,
        sevicetaxinr,
        totalinr,
        sevicetaxdoller,
        basicdoller,
        totaldoller,
        actualfees,
        fullfees,
        installment,
        batchid
    ];

    con.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating batch fees:', err);
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.json({ message: 'Batch fees updated successfully', result });
    });
});

app.post('/nodeapp/Update_Batch_Fees', (req, res) => {
    const {
        basicinr,
        sevicetaxinr,
        totalinr,
        sevicetaxdoller,
        basicdoller,
        totaldoller,
        actualfees,
        fullfees,
        installment,
        batchid
    } = req.body;

    const query = `
        UPDATE Batch_Mst SET
            INR_Basic = ?,
            INR_ServiceTax = ?,
            INR_Total = ?,
            Dollar_ServiceTax = ?,
            Dollar_Basic = ?,
            Dollar_Total = ?,
            Actual_Fees_Payment = ?,
            Fees_Full_Payment = ?,
            Fees_Installment_Payment = ?
        WHERE Batch_Id = ?
    `;

    const values = [
        basicinr,
        sevicetaxinr,
        totalinr,
        sevicetaxdoller,
        basicdoller,
        totaldoller,
        actualfees,
        fullfees,
        installment,
        batchid
    ];

    con.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating batch fees:', err);
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.json({ message: 'Batch fees updated successfully', result });
    });
});

app.post("/nodeapp/add_librarybook", (req, res) => {
    let {
        Book_Name,
        Book_No,
        Publisher,
        Total_Pages,
        Status,
        Remark,
        Book_Course,
        Author,
        Purchase_Dt,
        Amount,
        RackNo,
        uid,
    } = req.body;

    let sql;
    let param;

    if (uid === undefined) {
        // INSERT: Always check for duplicate Book_No
        const duplicateCheckSql = "SELECT * FROM Library_Book_Mst WHERE Book_No = ?";
        con.query(duplicateCheckSql, [Book_No], (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.length > 0) {
                return res.status(409).json("Duplicate Book Number");
            }

            sql = `INSERT INTO Library_Book_Mst 
                    (Book_Name, Book_No, Publisher, Total_Pages, Status, Remark, Book_Course, Author, Purchase_Dt, Amount, RackNo) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            param = [Book_Name, Book_No, Publisher, Total_Pages, Status, Remark, Book_Course, Author, Purchase_Dt, Amount, RackNo];

            con.query(sql, param, (err, data) => {
                if (err) {
                    console.error("SQL Insert Error:", err);
                    return res.status(500).json({ error: err.message });
                }
                return res.json(data);
            });
        });
    } else {
        // UPDATE: First fetch current Book_No
        const getCurrentSql = "SELECT Book_No FROM Library_Book_Mst WHERE Book_Id = ?";
        con.query(getCurrentSql, [uid], (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.length === 0) return res.status(404).json("Book not found");

            const currentBookNo = result[0].Book_No;

            if (currentBookNo !== Book_No) {
                // Book_No changed → check for duplicate
                const duplicateCheckSql = "SELECT * FROM Library_Book_Mst WHERE Book_No = ? AND Book_Id != ?";
                con.query(duplicateCheckSql, [Book_No, uid], (err, result) => {
                    if (err) return res.status(500).json(err);

                    if (result.length > 0) {
                        return res.status(409).json("Duplicate Book Number");
                    }

                    updateBook(); // perform update
                });
            } else {
                // Book_No unchanged → skip duplicate check
                updateBook();
            }

            function updateBook() {
                sql = `UPDATE Library_Book_Mst 
                        SET Book_Name = ?, Book_No = ?, Publisher = ?, Total_Pages = ?, Status = ?, Remark = ?, 
                            Book_Course = ?, Author = ?, Purchase_Dt = ?, Amount = ?, RackNo = ? 
                        WHERE Book_Id = ?`;

                param = [Book_Name, Book_No, Publisher, Total_Pages, Status, Remark, Book_Course, Author, Purchase_Dt, Amount, RackNo, uid];

                con.query(sql, param, (err, data) => {
                    if (err) return res.status(500).json(err);
                    return res.json("Data Updated");
                });
            }
        });
    }
});






app.post("/nodeapp/add_dicipline", (req, res) => {
    let Discipline = req.body.Discipline;

    let u_id = req.body.u_id;

    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into MST_Deciplin(`Deciplin`) values(?)";
        param = [Discipline];
    } else {
        sql = "update MST_Deciplin set Deciplin = ?  where Id = ? ";
        param = [Discipline, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.get("/nodeapp/get_dicipline", (req, res) => {
    const sql = "select Id,Deciplin from `MST_Deciplin` where IsDelete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/get_qualification", (req, res) => {
    const sql = "select Id,Education from `MST_Education` where IsDelete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/get_discipline", (req, res) => {
    const sql = "select Id,Deciplin from `MST_Deciplin` where IsDelete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/get_librarydata", (req, res) => {
    let tablename = req.body.tablename;
    let columnname = req.body.columnname;

    if (columnname == undefined) {
        const sql = `select * from ${tablename} where IsDelete = 0 ORDER BY Book_Id DESC `;

        con.query(sql, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    } else {
        const sql = `select ${columnname} from ${tablename} where IsDelete = 0 ORDER BY Book_Id DESC `;

        con.query(sql, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    }
});

app.post("/nodeapp/delete_librarydata", (req, res) => {
    let cat_id = req.body.cat_id;
    let tablename = req.body.tablename;
    ``
    const sql = `update ${tablename} set IsDelete = 1 where Book_Id = ?`;

    con.query(sql, [cat_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_qualification", (req, res) => {
    let Qualification = req.body.Qualification;

    let u_id = req.body.u_id;

    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into MST_Education(`Education`) values(?)";
        param = [Qualification];
    } else {
        sql = "update MST_Education set Education = ?  where Id = ? ";
        param = [Qualification, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.get("/nodeapp/get_bank", (req, res) => {
    const sql = "select Id,Bank_Name from `bank` where IsDelete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_bank", (req, res) => {
    let Bank = req.body.Bank;

    let u_id = req.body.u_id;

    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into bank(`Bank_Name`) values(?)";
        param = [Bank];
    } else {
        sql = "update bank set Bank_Name = ?  where Id = ? ";
        param = [Bank, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.get("/nodeapp/get_feesnotes", (req, res) => {
    const sql = "select Id,Perticular from `Fees_notes` where IsDelete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_feesnotes", (req, res) => {
    let FeesNote = req.body.FeesNote;

    let u_id = req.body.u_id;

    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into Fees_notes(`Perticular`) values(?)";
        param = [FeesNote];
    } else {
        sql = "update Fees_notes set Perticular = ?  where Id = ? ";
        param = [FeesNote, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.get("/nodeapp/get_hoilday", (req, res) => {
    const sql = "select Id,Holiday,Date_of_Holiday from `Holiday_master` where IsDelete = 0 ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_hoilday", (req, res) => {
    let Hoilday = req.body.Hoilday;
    let date = req.body.date;

    let u_id = req.body.u_id;
    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into Holiday_master(`Holiday`,`Date_of_Holiday`) values(?,?)";
        param = [Hoilday, date];
    } else {
        sql = "update Holiday_master set Holiday = ? , Date_of_Holiday = ? where Id = ? ";
        param = [Hoilday, date, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.get("/nodeapp/get_location", (req, res) => {
    const sql = "select id,LocationMaster from `Location_master` where IsDelete = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_location", (req, res) => {
    let Location = req.body.Location;

    let u_id = req.body.u_id;
    let sql;
    let param;

    if (u_id == undefined) {
        sql = "insert into Location_master(`LocationMaster`) values(?)";
        param = [Location];
    } else {
        sql = "update Location_master set LocationMaster = ? where Id = ? ";
        param = [Location, u_id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.post("/nodeapp/get_Faculty", (req, res) => {
    let tablename = req.body.tablename;

    const sql = `select * from ${tablename} where IsDelete = 0 `;

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/delete_Faculty", (req, res) => {
    let cat_id = req.body.cat_id;
    let tablename = req.body.tablename;

    const sql = `update ${tablename} set IsDelete = 1 where Faculty_Id = ?`;

    con.query(sql, [cat_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/update_faculty", (req, res) => {
    let u_id = req.body.u_id;
    let tablename = req.body.tablename;

    const sql = `select * from ${tablename} where Faculty_Id  = ?`;

    con.query(sql, [u_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_faculty", (req, res) => {
    let {
        Faculty_Name,
        Faculty_Code,
        DOB,
        Nationality,
        IsActive,
        InvoiceName,
        Married,
        Joining_Date,
        Faculty_Type,
        KnowSw,
        TrainingCategory,
        Present_Address,
        Present_City,
        Present_Pin,
        Present_State,
        Present_Country,
        Mobile,
        EMail,
        Permanent_Address,
        Permanent_City,
        Permanent_Pin,
        Permanent_State,
        Permanent_Country,
        uid,
    } = req.body;

    let sql;
    let param;

    console.log(uid);

    if (uid === undefined) {
        sql = `INSERT INTO faculty_master (Faculty_Name, Faculty_Code, DOB, Nationality, IsActive, InvoiceName, Married,Joining_Date, Faculty_Type, KnowSw, TrainingCategory, Present_Address,Present_City, Present_Pin, Present_State, Present_Country, Mobile, EMail,Permanent_Address, Permanent_City, Permanent_Pin, Permanent_State,Permanent_Country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`;

        param = [
            Faculty_Name,
            Faculty_Code,
            DOB,
            Nationality,
            IsActive,
            InvoiceName,
            Married,
            Joining_Date,
            Faculty_Type,
            KnowSw,
            TrainingCategory,
            Present_Address,
            Present_City,
            Present_Pin,
            Present_State,
            Present_Country,
            Mobile,
            EMail,
            Permanent_Address,
            Permanent_City,
            Permanent_Pin,
            Permanent_State,
            Permanent_Country,
        ];
    } else {
        sql = `UPDATE faculty_master SET Faculty_Name = ?, Faculty_Code = ?, DOB = ?, Nationality = ?, IsActive = ?, InvoiceName = ?, Married = ?, Joining_Date = ?, Faculty_Type = ?, KnowSw = ?, TrainingCategory = ?, Present_Address = ?, Present_City = ?, Present_Pin = ?, Present_State = ?, Present_Country = ?, Mobile = ?, EMail = ?, Permanent_Address = ?, Permanent_City = ?, Permanent_Pin = ?, Permanent_State = ?, Permanent_Country = ? WHERE Faculty_Id = ?`;

        param = [
            Faculty_Name,
            Faculty_Code,
            DOB,
            Nationality,
            IsActive,
            InvoiceName,
            Married,
            Joining_Date,
            Faculty_Type,
            KnowSw,
            TrainingCategory,
            Present_Address,
            Present_City,
            Present_Pin,
            Present_State,
            Present_Country,
            Mobile,
            EMail,
            Permanent_Address,
            Permanent_City,
            Permanent_Pin,
            Permanent_State,
            Permanent_Country,
            uid,
        ];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getcoursewisebatch", (req, res) => {
    const { courseid } = req.body;
    if (!courseid) {
        return res.status(400).json({ error: "Course ID is required" });
    }
    const sql = "select Batch_Id,Batch_code from Batch_Mst where Course_Id = ? order by Batch_Id desc";

    con.query(sql, [courseid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getbatchidwiselecture", (req, res) => {
    const { batch_code } = req.body;
    if (!batch_code) {
        return res.status(400).json({ error: "Course ID is required" });
    }
    const sql = "SELECT id,subject_topic FROM `Batch_SLecture_Master` where batch_id = ?";

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/get_collegecity", (req, res) => {
    const sql = "Select id,city FROM awt_college WHERE deleted = 0 and  city is not null GROUP BY city;"

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getlecturereport", (req, res) => {
    const { course, batch, lecture, faculty, year, month } = req.body;

    // Build dynamic SQL
    let sql = `
        SELECT 
            atm.Take_Id,
            atm.Lecture_Name,
            atm.Take_Dt,
            bm.Batch_code,
            atm.Topic,
            fm.Faculty_Name,
            atm.Lecture_Start,
            atm.Lecture_End  
        FROM lecture_taken_master AS atm
        LEFT JOIN Batch_Mst AS bm ON atm.Batch_Id = bm.Batch_Id
        LEFT JOIN faculty_master AS fm ON fm.Faculty_Id = atm.Faculty_Id
        WHERE 1=1
    `;

    const params = [];

    if (course) {
        sql += " AND atm.Course_Id = ?";
        params.push(course);
    }

    if (batch) {
        sql += " AND atm.Batch_Id = ?";
        params.push(batch);
    }

    if (lecture) {
        sql += " AND atm.Lecture_Id = ?";
        params.push(lecture);
    }

    if (faculty) {
        sql += " AND atm.Faculty_Id = ?";
        params.push(faculty);
    }

    if (year) {
        sql += " AND YEAR(atm.Take_Dt) = ?";
        params.push(year);
    }

    if (month) {
        sql += " AND MONTH(atm.Take_Dt) = ?";
        params.push(month);
    }

    con.query(sql, params, (err, data) => {
        if (err) {
            console.error("Error fetching lecture report:", err);
            return res.status(500).json({ error: "Database error" });
        } else {
            return res.json(data);
        }
    });
});



app.post("/nodeapp/getbatchwisestudent", (req, res) => {
    const { batch_code } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM `Student_Master` as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.Batch_Code =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        "SELECT DISTINCT  sm.Student_Id,sm.Student_Name,Student_Code FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_code = ? ORDER BY sm.Student_Name ASC";

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getbatchidwisestudent", (req, res) => {
    const { batch_Id } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM `Student_Master` as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.Batch_Code =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        "SELECT DISTINCT  sm.Student_Id,sm.Student_Name,Student_Code FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_Id = ? ORDER BY sm.Student_Name ASC";

    con.query(sql, [batch_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/gettransferstudent", (req, res) => {
    const { batch_code } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM `Student_Master` as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.Batch_Code =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        `SELECT DISTINCT sm.Student_Id, sm.Student_Name, am.Student_Code
FROM Admission_master am
JOIN Student_Master sm ON sm.Student_Id = am.Student_Id
JOIN Batch_Mst bm ON bm.Batch_Id = am.Batch_Id
WHERE am.Admission_Id IN (
    SELECT MAX(Admission_Id)
    FROM Admission_master
    WHERE IsDelete = 0
    GROUP BY Student_Id
)
AND am.IsDelete = 0
AND sm.Status_id = 8
AND bm.Batch_code = ?
ORDER BY sm.Student_Name ASC;
`;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getbatchstudent", (req, res) => {
    const { batch_Id } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM `Student_Master` as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.Batch_Code =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        "SELECT DISTINCT  am.Admission_Date, sm.Student_Id,sm.Student_Name,Student_Code FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id  = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND am.Batch_Id = ? ORDER BY sm.Student_Name ASC";

    con.query(sql, [batch_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getbatchstudent", (req, res) => {
    const { batch_Id } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM `Student_Master` as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.Batch_Code =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        "SELECT DISTINCT  sm.Student_Id,sm.Student_Name,Student_Code FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND am.Batch_Id = ? ORDER BY sm.Student_Name ASC";

    con.query(sql, [batch_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getsitevisitlocation", (req, res) => {
    const { Batch_Id } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM Student_Master as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.batch_Id =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        `SELECT DISTINCT sm.Location, sm.Visit_Id 
FROM Admission_master AS am 
LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = am.Batch_Id 
LEFT JOIN Site_visit_master AS sm ON sm.Batch_Id = bm.Batch_Id 
WHERE am.IsDelete = 0 
  AND am.IsActive = 1 
  AND bm.Batch_Id = ?
        AND sm.Location IS NOT NULL
ORDER BY sm.Location ASC`;

    con.query(sql, [Batch_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getsitevisitreport", (req, res) => {
    const { Batch_Id, Visit_Id } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM Student_Master as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.batch_Id =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        `SELECT DISTINCT sm.Location,sm.Visit_Id,bm.Batch_Id,bm.Batch_Code,sm.Visit_Date,sm.ConfirmDate,sm.Course_Name,s.Student_Name,am.Student_Code FROM Admission_master as am LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id LEFT JOIN Site_visit_master as sm on sm.Batch_Id = bm.Batch_Id LEFT JOIN Student_Master as s on s.Student_Id = am.Student_Id WHERE am.IsDelete = 0 AND am.IsActive = 1 AND bm.Batch_Id = 430 AND sm.Visit_Id = 98 ORDER BY s.Student_Name ASC`;

    con.query(sql, [Batch_Id, Visit_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/getconvocationguestlist", (req, res) => {
    const { Course_Id, StartYear, EndYear } = req.body;

    if (!Course_Id || !StartYear || !EndYear) {
        return res.status(400).json({ error: "Course_Id, StartYear, and EndYear are required." });
    }

    const startDate = `${StartYear}-01-01`;
    const endDate = `${EndYear}-12-31`;

    const sql = `
        SELECT 
            bm.Batch_Code,
            cm.Course_Name,
            cg.GName,
            cg.FName,
            cg.Mobile_no,
            cg.Email_id,
            cg.DateAdded,
             DAYNAME(cg.DateAdded) AS Days
        FROM 
            Convocation_Guest_List as cg 
        LEFT JOIN 
            Batch_Mst as bm ON bm.Batch_Id = cg.Batch_Id 
        LEFT JOIN 
            Course_Mst as cm ON cm.Course_Id = bm.Course_Id 
        WHERE 
            cm.Course_Id = ? 
            AND cg.DateAdded BETWEEN ? AND ?
        ORDER BY 
            cg.DateAdded DESC
    `;

    con.query(sql, [Course_Id, startDate, endDate], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});




app.post("/nodeapp/getattendStudent", (req, res) => {
    const { batch_code } = req.body;

    const studentSql = `
      SELECT DISTINCT 
        sm.Student_Id,
        sm.Student_Name,
        am.Student_Code,
        cm.Course_Name
      FROM Admission_master as am
      LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id
      LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id
      LEFT JOIN Course_Mst as cm on cm.Course_Id = bm.Course_Id
      WHERE am.IsDelete = 0 
        AND am.IsActive = 1 
        AND sm.Status_id = 8 
        AND bm.Batch_Code = ?
      ORDER BY sm.Student_Name ASC
    `;

    const lectureSql = `SELECT COUNT(*) AS lecture_count FROM lecture_taken_master as l 
Left Join Batch_Mst as b on b.Batch_Id = l.Batch_id where b.Batch_code = ?;`;

    con.query(studentSql, [batch_code], (err, studentData) => {
        if (err) return res.json(err);

        con.query(lectureSql, [batch_code], (err, lectureData) => {
            if (err) return res.json(err);

            return res.json({
                students: studentData,
                lecture_count: lectureData[0]?.lecture_count || 0
            });
        });
    });
});


app.post("/nodeapp/getassignmentreceipt", (req, res) => {
    const { batch_code } = req.body;

    const sql = `SELECT Batch_Id FROM Batch_Mst WHERE Batch_code = ?`;
    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err.message });
        }

        if (!data.length) {
            return res.json({ error: true, message: "Batch not found" });
        }

        const Batch_Id = data[0].Batch_Id;
        const sql2 = `
          SELECT at.Assign_No, agc.Student_Name, at.Assign_Dt, bm.Batch_code, cm.Course_Name , ats.assignmentname FROM Assignment_taken AS at LEFT JOIN Assignment_given_child AS agc ON agc.Given_Id = at.Given_Id LEFT JOIN  assignmentstaken as ats on ats.id = at.Assignment_Id LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = at.Batch_Id LEFT JOIN Course_Mst AS cm ON cm.Course_Id = bm.Course_Id WHERE at.Batch_Id = ?  order by at.Assign_No asc`;

        con.query(sql2, [Batch_Id], (err, data2) => {
            if (err) {
                return res.json({ error: true, message: err.message });
            } else {

                const sql3 = `SELECT at.Assign_No, at.Assign_Dt, ats.assignmentname FROM Assignment_taken AS at LEFT JOIN assignmentstaken as ats on ats.id = at.Assignment_Id LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = at.Batch_Id LEFT JOIN Course_Mst AS cm ON cm.Course_Id = bm.Course_Id WHERE at.Batch_Id = ? group by at.Assign_No    order by at.Assign_No asc`;

                con.query(sql3, [Batch_Id], (err, finaldata) => {
                    if (err) {
                        return res.json(err)
                    } else {

                        return res.json({ error: false, Student_data: data2, headerdata: finaldata });
                    }
                })
            }

        });
    });
});


app.post("/nodeapp/getidStudent", (req, res) => {
    const { batch_code } = req.body;

    const sql = `
WITH LatestAdmission AS (
    SELECT 
        am.*,
        ROW_NUMBER() OVER (PARTITION BY am.Student_Id ORDER BY am.Admission_Date DESC) AS rn
    FROM Admission_master am
    WHERE am.IsDelete = 0 AND am.IsActive = 1
),
LatestDoc AS (
    SELECT 
        d.Student_id,
        d.upload_image,
        ROW_NUMBER() OVER (PARTITION BY d.Student_id ORDER BY d.id DESC) AS rn
    FROM Documents d
 WHERE d.doc_name IN ('photo','Photo', 'photo.jpg', 'photo.png', 'Photo.jpg', 'Photo.png','Photo.jpeg','photo.jpeg')
)
SELECT 
    sm.Student_Id,
    sm.Student_Name,
    sm.Present_Mobile,
    la.Admission_Date,
    la.Student_Code,
    sm.Present_Address,
    sm.Present_Tel,
    cm.Course_Name,
    ld.upload_image,
    bm.Batch_code,
    bm.EDate AS Valid_Date
FROM Student_Master sm
LEFT JOIN LatestAdmission la 
       ON la.Student_Id = sm.Student_Id AND la.rn = 1
LEFT JOIN Batch_Mst bm 
       ON bm.Batch_Id = la.Batch_Id
LEFT JOIN Course_Mst cm 
       ON cm.Course_Id = sm.Course_Id
LEFT JOIN LatestDoc ld 
       ON ld.Student_id = sm.Student_Id AND ld.rn = 1
WHERE sm.IsDelete = 0 
  AND sm.Status_id = 8
  AND bm.Batch_Code = ?
ORDER BY sm.Student_Name ASC;
    `;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {

            // attach base64 image to each student
            const updatedData = data.map(student => ({
                ...student,
                base64Image: imageToBase64(student.Student_Id, student.upload_image)
            }));

            return res.json(updatedData);
        }
    });
});


app.post("/nodeapp/getidStudentstudy", (req, res) => {
    const { batch_code } = req.body;

    const sql = `
       SELECT 
    sm.Student_Id,
    sm.Student_Name,
    sm.Present_Mobile,
    am.Admission_Date,
    am.Student_Code,
    sm.Present_Address,
    sm.Present_Tel,
    cm.Course_Name,
    d.upload_image,
    bm.Batch_code,
    bm.EDate AS Valid_Date,
    fees.Total_Amount AS Total_Amount,
    bm.Fees_Full_Payment,
    bm.Fees_Full_Payment - fees.Total_Amount AS Balance,
    CASE 
        WHEN bm.Fees_Full_Payment - fees.Total_Amount <= 0 THEN 'Yes'
        ELSE 'No'
    END AS Fees_Paid
FROM Student_Master AS sm
LEFT JOIN Admission_master AS am 
    ON am.Student_Id = sm.Student_Id
LEFT JOIN Batch_Mst AS bm 
    ON bm.Batch_Id = am.Batch_Id
LEFT JOIN Course_Mst AS cm 
    ON cm.Course_Id = bm.Course_Id
LEFT JOIN Documents AS d 
    ON d.Student_id = sm.Student_Id 
    AND d.doc_name = 'photo'
LEFT JOIN (
    SELECT Student_Id, SUM(Amount) AS Total_Amount
    FROM S_Fees_Mst where TypeR = 'C'
    GROUP BY Student_Id
) AS fees 
    ON fees.Student_Id = sm.Student_Id
WHERE sm.IsDelete = 0 
  AND am.IsDelete = 0 
  AND am.IsActive = 1 
  AND sm.Status_id = 8 
  AND bm.Batch_Code = ?
ORDER BY sm.Student_Name ASC;
    `;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getbatchwisefees", (req, res) => {
    const { batch_code } = req.body;

    const sql = `
WITH FeeTotals AS (
    SELECT 
        Student_Id, 
        SUM(Total_Amt) AS Total_Amt,
        SUM(Amount) AS Amount,
        SUM(UnPaid_Amt) AS UnPaid_Amt
    FROM S_Fees_Mst where TypeR = 'C' AND IsDelete = 0
    GROUP BY Student_Id
)
-- Step 2: Join directly with Admission_master without latest filter
SELECT 
    f.Student_Id,
    f.Amount,
    f.Total_Amt,
    f.UnPaid_Amt,
    sm.Student_Name, 
    bm.Batch_code,
    bm.Category, 
    bm.SDate, 
    bm.EDate, 
    bm.Fees_Full_Payment,
    cm.Course_Name,
    CASE 
        WHEN am.Transfered = 'Yes' THEN 'Transfer'
        ELSE ''
    END AS Transfer_Status
FROM FeeTotals f
LEFT JOIN Admission_master am ON am.Student_Id = f.Student_Id
LEFT JOIN Student_Master sm ON sm.Student_Id = f.Student_Id
LEFT JOIN Batch_Mst bm ON bm.Batch_Id = am.Batch_Id
LEFT JOIN Course_Mst cm ON cm.Course_Id = am.Course_Id
LEFT JOIN (
    SELECT student, ROW_NUMBER() OVER (PARTITION BY student ORDER BY id DESC) AS rn
    FROM awt_batchtransfer
) abt ON abt.student = f.Student_Id AND abt.rn = 1
WHERE bm.Batch_code = ? and am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8
ORDER BY f.Student_Id DESC

  `;

    con.query(sql, [batch_code, batch_code], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            return res.json(data);
        }
    });
});



app.post("/nodeapp/getbatchwiselecture", (req, res) => {
    const { batch_id } = req.body;

    const sql = "select id, batch_id ,subject_topic from Batch_SLecture_Master where batch_id = ? and deleted = 0";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getbatchwisemoc", (req, res) => {
    const { batch_id } = req.body;

    const sql = "select id, batch_id ,subject,date,marks from Batch_Moc_Master where batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getbatchwisefinalexam", (req, res) => {
    const { batch_id } = req.body;

    const sql = "select id, subject,exam_date,max_marks from awt_batch_exam where batch_id = ?";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getfaculty", (req, res) => {
    const sql = "select Faculty_Id, Faculty_Name from `faculty_master` where IsDelete = 0 order by Faculty_Name asc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getbatchwiseassignment", (req, res) => {
    const { batch_id } = req.body;

    const sql =
        "select id, batch_id ,assignmentname , marks ,assignmentdate from assignmentstaken where batch_id = ? and deleted = 0";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getbatchwiseunittest", (req, res) => {
    const { AnnulBatch } = req.body;

    const sql = "select id,subject,marks,utdate from awt_unittesttaken where batch_id = ? and deleted = 0";

    con.query(sql, [AnnulBatch], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getassignmentstakendata", (req, res) => {
    const sql = `SELECT ast.Given_Id ,ast.Assign_Dt,ast.Return_Dt, cm.Course_Name , bm.Batch_code, atn.assignmentname, atn.subjects FROM Assignment_taken as ast left join assignmentstaken as atn on ast.Assignment_Id = atn.id
   LEFT JOIN Course_Mst as cm on ast.Course_Id = cm.Course_Id LEFT JOIN Batch_Mst as bm on  ast.Batch_Id = bm.Batch_Id LEFT JOIN faculty_master as fm on ast.Faculty_Id = fm.Faculty_Id WHERE ast.IsDelete = 0 order by ast.Given_Id desc`;

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getunittesttakendata", (req, res) => {
    const sql =
        "SELECT ast.Take_Id ,ast.Test_Dt , cm.Course_Name , bm.Batch_code ,an.subject FROM `Test_taken_master` as ast LEFT JOIN Course_Mst as cm on ast.Course_Id = cm.Course_Id LEFT JOIN Batch_Mst as bm on  ast.Batch_Id = bm.Batch_Id  LEFT JOIN awt_unittesttaken as an on ast.Test_Id = an.id  WHERE ast.IsDelete = 0  order by ast.Take_Id Desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getvivamoctakendata", (req, res) => {
    const sql =
        "SELECT ast.Take_Id ,ast.Take_Dt , cm.Course_Name , bm.Batch_code,av.vivamocname FROM `viva_taken` as ast LEFT JOIN Course_Mst as cm on ast.Course_Id = cm.Course_Id LEFT JOIN Batch_Mst as bm on ast.Batch_Id = bm.Batch_Id LEFT JOIN awt_vivamoctaken as av ON av.id = ast.Viva_Id WHERE ast.IsDelete = 0 order by ast.Take_Id asc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.get("/nodeapp/getfinalexam", (req, res) => {
    const sql =
        "SELECT ast.Take_Id ,ast.Test_Dt , cm.Course_Name , bm.Batch_code FROM `Final_exam_master` as ast LEFT JOIN Course_Mst as cm on ast.Course_Id = cm.Course_Id LEFT JOIN Batch_Mst as bm on  ast.Batch_Id = bm.Batch_Id  WHERE ast.IsDelete = 0 order by ast.Take_Id Desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getcoursecode", (req, res) => {
    const sql = "select * from Course_Mst ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            const getlength = data.length + 1;
            return res.json({ code: getlength });
        }
    });
});

// app.post("/nodeapp/updateadmissionstatus", (req, res) => {
//     let { statusid, student_id } = req.body;

//     const sql = "update Student_Master set Status_Id = ? where Student_Id = ?";

//     con.query(sql, [statusid, student_id], (err, data) => {
//         if (err) {
//             return res.json(err);
//         } else {
//             return res.json(data);
//         }
//     });
// });


app.post("/nodeapp/updateadmissionstatus", async (req, res) => {
    let { statusid, student_id } = req.body;


    const getstudentdetails = `select  sm.Student_Name , sm.Email , sm.Batch_code , cm.Course_Name from Student_Master as sm left join Course_Mst as cm on cm.Course_Id = sm.Course_Id where sm.Student_Id = ?`

    con.query(getstudentdetails, [student_id], (err, data) => {
        if (err) {
            return res.json(err)
        } else {

            const Student_Name = data[0].Student_Name;
            const email = data[0].Email;
            const Batch_code = data[0].Batch_code;
            const Course_Name = data[0].Course_Name;

            if (statusid == 9) {

                const sql = "update Student_Master set Status_Id = ? where Student_Id = ?";

                con.query(sql, [statusid, student_id], async (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {

                        const htmlbody = `
       <html lang="en">
    
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
        <title>Document</title>
        <style>
            body{
                font-family: "Roboto", sans-serif;
            }
            p {
                color: #335F9B;
            }
            .font600 {
            font-weight: 600;
            }
            .m-0{
                margin: 0px;
            }
            .color-light{
            color: #4F81BD;
            }
            .last p{
                font-size: 10px;
            }
        </style>
    </head>
    
    <body>
        <p>Dear <b>${Student_Name},</b></p>
        <p>Warm greetings from SIT!!!</p>
        <p>Your admission form is accepted for ${Course_Name} - ${Batch_code}.</p>
        <p><b>Please find the attach documents, request you to kindly read the same and send us the signed copy of it.</b></p>
        <p>Kindly make the payment as earliest to confirm your admission</p>
        <p><b>You can do the payment through NEFT; RTGS or you can directly deposit the cheque in our axis bank account</b></p>
        <p style="text-decoration: underline;">Please find below bank details of SIT :</p>
        <div style="display: flex;">
            <p>Bank account name</p>
            <p style="padding-left: 100px;">: Suvidya Institute of Technology Pvt. Ltd.</p>
        </div>
        <div style="display: flex;">
            <p>Bank Name</p>
            <p style="padding-left: 148px;">: Axis Bank Ltd.</p>
        </div>
        <div style="display: flex;">
            <p>Branch Address</p>
            <p style="padding-left: 125px;">: Vakola, Mumbai (MH), City Survey No. 841 to 846,<br>Florence Lorenace chs ltd. Mumbai 400055.</p>
        </div>
        <div style="display: flex;">
            <p>Bank Account No</p>
            <p style="padding-left: 117px;">: 911020002988600</p>
        </div>
        <div style="display: flex;">
            <p>IFSC code for NEFT payment </p>
            <p style="padding-left: 46px;">: UTIB0001244</p>
        </div>
        <div style="display: flex;">
            <p>MICR Code</p>
            <p style="padding-left: 150px;">: 400211082</p>
        </div>
        <div style="display: flex;">
            <p>Swift Code</p>
            <p style="padding-left: 150px;">: AXISINBB028</p>
        </div>
    
        <p>Mention your Reference no. (mentioned in subject of this mail)  in all correspondence.</p>
    
        <p><b>Please find attached herewith Procedure & Rules & Regulation for your information.</b></p>
        <p><b>Please mail us payment slip/bank payment advice after payment.  For any queries related to accounts, call on 022-61943120 or mail on</b><a  href="mailto:manasipanchal@suvidya.ac.in" style="text-decoration: underline;"> manasipanchal@suvidya.ac.in</a></p>
    
        <p class="m-0 font600 color-light">Regards,</p>
        <p class="m-0 font600 color-light">Vaidehi Patankar</p>
        <p class="m-0 font600 color-light">Sr. Executive Career Building Department</p>
        <p class="m-0 font600 color-light">Mobile No: 9167219405</p>
        <p class="m-0 font600 color-light">Tel: 91 022 26682295, 91 022 26682290 - Ext.101</p>
    
        <div>
            <p><a href="mailto:www.suvidya.ac.in ">www.suvidya.ac.in  </a>  |  <a href="mailto:www.accent.net.in">www.accent.net.in</a></p>
    
            <p class=" font600 color-light">Follow Simple Rules – Change Food to Improve Immunity, Use Mask, Keep Safe Distance, use Sanitiser, Be Happy and Be Healthy.</p>
            <p class=" font600 color-light">Print if it is very much necessary to support environment as one Kg paper need 10 litres of water.</p>
            <p class=" font600 color-light">Disclaimer – Email contents are for your information only, if you do not wish to received then please feel free  to infrom us happily, will stop sending with immediate effect.</p>
    
            <img style="width: 100px;" src="https://ci3.googleusercontent.com/meips/ADKq_NbsTBI0TbxWtHsgK4sZiEjQKNTdIHzy9jy8nKKE_9hmO0Wf6ofXFypOTD-0REzIfxiG23CcpvDEBSdVzxc-wEUDQ3IRel8=s0-d-e1-ft#http://sit.suvidya.ac.in/images/suvidya_logo.jpg" alt="">
    
            <p style="font-size: 13px;"><b>Suvidya Institute of Technology Pvt. Ltd.</b></p>
            <p style="font-size: 13px;"><b>An ISO 9001:2015 Certified Organisation by Bureau of Indian Standards</b></p>
            <p style="font-size: 13px;margin-top: 30px;"><b>18/140,  Anand Nagar, Nehru Road, Vakola,</b></p>
            <p style="font-size: 13px;"><b>Santacruz (East), Mumbai – 400 055.</b></p>
    
            <div style="margin: 20px 0px;" class="last">
              <p>Tel: 91 022 26682290 Ext.11, 16. Cell:9821569885</p>
              <p>Email : vaidehipatankar@suvidya.ac.in</p>
              <p>Website : <a href="https://www.suvidya.ac.in" target="_blank">www.suvidya.ac.in</a></p>
    
            </div>
    
            <p style="font-family: 'Satisfy', cursive;"><b>“Together we will bring new dimension to engineering industry”</b></p>
    
        </div>
    
    </body>
    
    </html>
      `;

                        try {
                            const client = new SendMailClient({ url, token });

                            const response = await axios.get('https://sitsuvidya.in/uploads/Procedure.pdf', {
                                responseType: 'arraybuffer',
                            });

                            const base64Pdf = Buffer.from(response.data, 'binary').toString('base64');

                            await client.sendMail({
                                from: {
                                    address: "noreply@sitsuvidya.in",
                                    name: "noreply",
                                },
                                to: [
                                    {
                                        email_address: {
                                            address: email,
                                            name: Student_Name,
                                        },
                                    },
                                ],
                                cc: [
                                    {
                                        email_address: {
                                            address: "santoshmestry@suvidya.ac.in",
                                            name: "Santosh Mestry",
                                        },
                                    },
                                    {
                                        email_address: {
                                            address: "vaidehipatankar@suvidya.ac.in",
                                            name: "Vaidehi Patankar",
                                        },
                                    },
                                    {
                                        email_address: {
                                            address: "saloniphatak@suvidya.ac.in",
                                            name: "Saloni Phatak",
                                        },
                                    }
                                ],
                                subject: `Admission Acceptance. Your Reference No. is: ${student_id}`,
                                htmlbody: htmlbody,
                                attachments: [
                                    {
                                        content: base64Pdf,
                                        mime_type: "application/pdf",
                                        name: "Procedure.pdf"
                                    }
                                ]
                            });



                            res.status(200).json({ message: "Email sent successfully" });
                        } catch (mailError) {
                            res.status(500).json({ error: "Email sending failed", details: mailError });
                        }

                    }
                });


            } else {


                const sql = "update Student_Master set Status_Id = ? where Student_Id = ?";

                con.query(sql, [statusid, student_id], (err, data) => {
                    if (err) {
                        return res.json(err);
                    } else {
                        return res.json(data);
                    }
                });
            }

        }
    })


});

app.post("/nodeapp/getfilterbatch", (req, res) => {
    let { selectcourse, from_date, to_date } = req.body;

    let sql;
    let param;

    if ((selectcourse && from_date, to_date)) {
        sql =
            "SELECT * FROM `Batch_Mst` as b left JOIN `Course_Mst`as c on b.Course_Id = c.Course_Id where b.SDate BETWEEN ? and ? and b.Course_Id = ? and b.IsDelete = 0";
        param = [from_date, to_date, selectcourse];
    } else if (selectcourse) {
        sql =
            "SELECT * FROM `Batch_Mst` as b left JOIN `Course_Mst`as c on b.Course_Id = c.Course_Id where b.Course_Id = ? and b.IsDelete = 0";
        param = [selectcourse];
    } else {
        sql =
            "SELECT * FROM `Batch_Mst` as b left JOIN `Course_Mst`as c on b.Course_Id = c.Course_Id where b.SDate BETWEEN ? and ? and b.IsDelete = 0";
        param = [from_date, to_date];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            //   const getlength = data
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getfilterinqury", (req, res) => {
    let { from_date, to_date } = req.body;

    let sql;
    let param;

    sql =
        "SELECT i.Inquiry_Id as id,i.Student_Id,i.FName, i.LName, i.MName,i.Student_Name,i.Course_Id,i.Qualification, i.Discussion, i.present_mobile, i.Email, i.Discipline, i.Inquiry_type, i.isActive, i.inquiry_DT, c.Course_Name, i.Percentage , sm.Status , md.Deciplin , i.IsUnread FROM Student_Inquiry AS i LEFT JOIN Course_Mst AS c ON i.Course_id = c.Course_Id LEFT JOIN Status_Master as sm on sm.Id = i.OnlineState left JOIN MST_Deciplin as md on md.Id = i.Discipline WHERE i.isDelete = 0  and i.Admission != 1 and i.Inquiry_Dt >= ? and  i.Inquiry_Dt <= ?  order by i.Inquiry_Id desc ";
    param = [from_date, to_date];

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            //   const getlength = data
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getBatchCode", (req, res) => {
    let { batch } = req.body;

    const sql = "SELECT * FROM `Batch_Mst` where Batch_Id = ? ";

    con.query(sql, [batch], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getStudentCount", (req, res) => {
    let { batch } = req.body;
    let date = new Date();
    let year = date.getFullYear(); // Extract the current year
    const sql = "SELECT COUNT(*) as total FROM Admission_master as am LEFT join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where bm.Batch_code = ?";

    con.query(sql, [batch], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getprintinfo", (req, res) => {
    let { id } = req.body;

    const sql =
        "SELECT * FROM `Admission_master` as a left join `Student_Master`as o on a.Student_Id = o.Student_Id WHERE Admission_Id = ? ";

    con.query(sql, [id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getdatas", (req, res) => {
    let { fromdate, fromtodate, selectcourse, rollnumberallot, selctbatch, allinquiries, all } = req.body;
    let sql;
    let param;
    param = [];
    sql = `SELECT 
            i.Student_Name as Student_Name,
            i.Qualification,
            i.Inquiry_type,
            i.Batch_Code as Batch_Code,
            i.inquiry_DT,
            i.Email,
            i.Present_Mobile,
            c.Course_Name,
            mb.BatchCategory AS BatchCategory,
            i.Inquiry_Id as id,
            i.Student_Id,
            i.FName, i.LName,i.MName,
            i.Course_Id,
            i.Discussion,
            i.Discipline,
            i.isActive,
            i.Percentage,
            sm.Status as OnlineStatus,
            smtp.Status as MasterStatus, 
            md.Deciplin,
            i.IsUnread,
            JSON_ARRAYAGG(discussions.discussion) AS discussion_arr 
            FROM Student_Inquiry AS i
            LEFT JOIN MST_BatchCategory mb ON mb.id = i.Batch_Category_id
            LEFT JOIN Status_Master as sm on sm.Id = i.OnlineState
            LEFT JOIN Student_Master smm ON smm.Student_Id = i.Student_Id
            LEFT JOIN Status_Master smtp ON smtp.Id = smm.Status_id
            LEFT JOIN Course_Mst AS c ON i.Course_id = c.Course_Id
            left JOIN MST_Deciplin as md on md.Id = i.Discipline
            LEFT JOIN (
                SELECT ranked.student_id, ranked.discussion, ranked.date, ranked.Inquiry_id
                FROM (
                    SELECT id.student_id, id.discussion, id.date, id.Inquiry_id,
                    ROW_NUMBER() OVER (PARTITION BY id.Inquiry_id ORDER BY id.created_date DESC) AS row_num
                    FROM awt_inquirydiscussion AS id
                ) ranked
                 WHERE ranked.row_num <= 3
                ) AS discussions 
                ON i.Inquiry_Id = discussions.Inquiry_id 
            WHERE i.isDelete = 0  and i.Admission != 1  `;

    if (fromdate && fromtodate) {
        sql += " AND i.Inquiry_Dt >= ? AND i.Inquiry_Dt <= ?";
        param.push(fromdate, fromtodate);
    }
    if (selectcourse) {
        sql += " AND i.Course_Id = ?";
        param.push(selectcourse);
    }
    if (rollnumberallot) {
        sql += " AND i.Batch_Category_id = ?";
        param.push(rollnumberallot);
    }
    if (selctbatch && selctbatch.length > 0) {
        sql += ` AND i.Batch_Code IN (${selctbatch.map(() => "?").join(", ")}) `;
        param = param.concat(selctbatch);
    }
    if (allinquiries) {
        sql += " And  i.OnlineState = ? ";
        param.push(allinquiries);
    }
    if (all) {
        sql += " AND i.Refered_By = ?";
        param.push(all);
    }

    sql += " group by  i.Inquiry_Id order by i.inquiry_DT desc";

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getcollegefollow", (req, res) => {
    let collegeid = req.body.collegeid;

    const sql = "select * from `College_Follows` where College_id = ? and IsDelete = 0";

    con.query(sql, [collegeid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getcollegestudent", (req, res) => {
    let collegeid = req.body.collegeid;

    const sql = "select * from `Student_Master` where college_id = ? and IsDelete = 0";

    con.query(sql, [collegeid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getfollowdetails", (req, res) => {
    let followid = req.body.followid;

    const sql = "select * from `College_Follows` where Follow_id = ?  ";

    con.query(sql, [followid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.post("/nodeapp/getAllStudent", (req, res) => {
    const { page = 0, pageSize = 10 } = req.body; // Default values if page or pageSize are not provided

    // Calculate the offset for pagination
    const offset = page * pageSize;

    // Main query for fetching paginated data
    const dataQuery = `
    SELECT DISTINCT  sm.Student_Id, bm.Batch_code, sm.Student_Name, sm.Present_Address, sm.Email, sm.Present_Mobile, 
           sm.Qualification, sm.IsActive, stm.Status, sm.Admission_Dt, am.Admission_Id 
    FROM Admission_master as am 
    LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id 
    LEFT JOIN Status_Master as stm ON stm.Id = sm.Status_id 
    LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  
    WHERE am.IsDelete = 0 AND sm.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8
    ORDER BY am.Admission_Id DESC 
    LIMIT ? OFFSET ?`;

    // Query for counting the total number of students matching the criteria
    const countQuery = `
    SELECT COUNT(*) as totalCount 
    FROM Admission_master as am 
    LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id 
    WHERE am.IsDelete = 0 AND am.IsActive = 1 `;

    // Execute both queries in parallel
    con.query(dataQuery, [pageSize, offset], (err, data) => {
        if (err) {
            return res.json({ error: err.message });
        }

        con.query(countQuery, (err, countResult) => {
            if (err) {
                return res.json({ error: err.message });
            }

            const totalCount = countResult[0]?.totalCount || 0; // Get total count from the count query

            // Determine the last student ID
            let lastStudentId = null;
            if (data.length > 0) {
                lastStudentId = data[data.length - 1].Student_Id;
            }

            // Respond with paginated data and total count
            return res.json({ data, totalCount, lastStudentId });
        });
    });
});

app.post("/nodeapp/collegechange", (req, res) => {
    let studentIds = req.body.studentid; // assuming an array of student IDs
    let collegeId = req.body.collegeid; // assuming a single college ID

    let promises = [];

    studentIds.forEach((studentId) => {
        const sql = "UPDATE `Student_Master` SET college_id = ? WHERE Student_Id = ?";

        promises.push(
            new Promise((resolve, reject) => {
                con.query(sql, [collegeId, studentId], (err, data) => {
                    if (err) {
                        return reject(err);
                    } else {
                        resolve(data);
                    }
                });
            })
        );
    });

    // Wait for all promises to resolve
    Promise.all(promises)
        .then((results) => {
            return res.json({ success: true, results });
        })
        .catch((err) => {
            return res.status(500).json({ error: err.message });
        });
});

app.post("/nodeapp/add_grade", (req, res) => {
    const { start_from, end_from, grade, batchid, id } = req.body;
    const date = new Date();
    let sql;
    let param;

    if (!id) {
        sql = "insert into grades (`batch_id`,`start_from`,`end_from`,`grade`,`created_date`) values (?,?,?,?,?)";
        param = [batchid, start_from, end_from, grade, date];
    } else {
        sql =
            "update grades set `batch_id` = ? , `start_from` = ? , `end_from` = ? ,`grade` = ? , `updated_date` = ? where id = ? ";
        param = [batchid, start_from, end_from, grade, date, id];
    }
    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/get_grade", (req, res) => {
    let { batchid } = req.body;

    const sql = "SELECT * FROM `grades` where batch_id = ? and deleted = 0 order by start_from desc";
    const param = [batchid];

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/Update_batch_result", (req, res) => {
    const { batchid, unit_test, assignment_wt, exam_wt, full_atten_wt, absent_wt, last_mark_limit, uid } = req.body;
    const date = new Date();

    const update_sql =
        "update Batch_Mst set LateMarkLimit = ?,AttendWtg = ?,FullAttendWtg = ?,ExamWtg = ?,AssignWtg =?,UnitTestWtg = ? where Batch_Id = ?";

    con.query(
        update_sql,
        [last_mark_limit, absent_wt, full_atten_wt, exam_wt, assignment_wt, unit_test, batchid],
        (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        }
    );
});

app.post("/nodeapp/add_vist_data", (req, res) => {
    const { company, contact_person, designation, phone, visit_date, address, batchid, uid } = req.body;

    const date = new Date();
    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into awt_batch_side_visit (`batch_id`,`company` ,`contact_person` ,`designation` ,`phone` ,`visit_date` ,`address` ,`created_date`) values (?,?,?,?,?,?,?,?)";
        param = [batchid, company, contact_person, designation, phone, visit_date, address, date];
    } else {
        sql =
            "update awt_batch_side_visit set batch_id = ? , company = ? ,contact_person = ? ,designation = ? ,phone = ? ,visit_date = ? ,address = ? ,created_date = ? where id = ? ";
        param = [batchid, company, contact_person, designation, phone, visit_date, address, date, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_sit_mlwfmaster", (req, res) => {
    const { formdate, todate, grossupto, chargeswill, otherwise, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into sit_mlwfmaster (`formdate`, `todate`, `grossupto`, `chargeswill`, `otherwise`) value (?,?,?,?,?)";
        param = [formdate, todate, grossupto, chargeswill, otherwise];
    } else {
        sql =
            "update `sit_mlwfmaster` set formdate = ? , todate = ? , grossupto = ? , chargeswill = ? , otherwise = ? where id = ?";
        param = [formdate, todate, grossupto, chargeswill, otherwise, uid];
    }
    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_qms_master", (req, res) => {
    const { QMS_name, QMS_Desc, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into qms_master (`QMS_name`, `QMS_Desc`) value (?,?)";
        param = [QMS_name, QMS_Desc];
    } else {
        sql = "update qms_master set QMS_name = ? , QMS_Desc = ? where  Id = ?";
        param = [QMS_name, QMS_Desc, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getqms_master", (req, res) => {
    const sql = "select * from `qms_master` Where IsDelete = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_sit_eptaxmaster", (req, res) => {
    const { from_sal, to_sal, tax_price, sep_mnth, sep_tax_price, uid } = req.body;

    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into sit_eptaxmaster (`from_sal`,	`to_sal`,	`tax_price`,	`sep_mnth`,	`sep_tax_price` ) value (?,?,?,?,?)";
        param = [from_sal, to_sal, tax_price, sep_mnth, sep_tax_price];
    } else {
        sql = `update sit_eptaxmaster set from_sal = ? , to_sal = ? , tax_price = ? , sep_mnth = ? , sep_tax_price = ? where id = ?`;
        param = [from_sal, to_sal, tax_price, sep_mnth, sep_tax_price, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getsit_eptaxmaster", (req, res) => {
    const sql = "select * from `sit_eptaxmaster` Where deleted = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_exam_data", (req, res) => {
    const { batchid, subject, exam_date, max_mark, duration, uid } = req.body;

    const date = new Date();
    let sql;
    let param;

    if (uid == undefined) {
        sql =
            "insert into awt_batch_exam (`batch_id`,`subject` , `exam_date` , `max_marks` , `duration` ,`created_date`) values (?,?,?,?,?,?)";
        param = [batchid, subject, exam_date, max_mark, duration, date];
    } else {
        sql =
            "update awt_batch_exam set batch_id = ? ,subject = ? , exam_date = ? ,max_marks = ? ,duration = ? ,created_date = ? where id = ? ";
        param = [batchid, subject, exam_date, max_mark, duration, date, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/update_lecture_child", async (req, res) => {
    const students = req.body;

    try {
        // Wrap the database operations in a promise to use async/await
        const updateStudent = (student) => {
            return new Promise((resolve, reject) => {
                const { Student_Reaction, Student_Atten, In_Time, Out_Time, AssignmentReceived, ID } = student;
                const updatedata = `UPDATE Lecture_taken_child SET Student_Reaction = ?, Student_Atten = ?,  In_Time = ?,  Out_Time = ?, AssignmentReceived = ? 
                  WHERE ID = ?`;

                con.query(
                    updatedata,
                    [Student_Reaction, Student_Atten, In_Time, Out_Time, AssignmentReceived, ID],
                    (err, result) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(result);
                    }
                );
            });
        };

        // Iterate over all students and update each one
        for (const student of students) {
            await updateStudent(student);
        }

        res.status(200).json({ message: "Students data updated successfully" });
    } catch (err) {
        console.error("Error updating student data:", err);
        res.status(500).json({ error: "Error updating student data", details: err });
    }
});

app.post("/nodeapp/update_assignment_child", async (req, res) => {
    const students = req.body;

    try {
        // Wrap the database operations in a promise to use async/await
        const updateStudent = (student) => {
            return new Promise((resolve, reject) => {
                const { Marks_Given, Status, ID } = student;
                const updatedata = `UPDATE Assignment_given_child set Marks_Given = ? ,Status = ?  WHERE ID = ?`;

                con.query(updatedata, [Marks_Given, Status, ID], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        };

        // Iterate over all students and update each one
        for (const student of students) {
            await updateStudent(student);
        }

        res.status(200).json({ message: "Students data updated successfully" });
    } catch (err) {
        console.error("Error updating student data:", err);
        res.status(500).json({ error: "Error updating student data", details: err });
    }
});

app.post("/nodeapp/update_unittest_child", async (req, res) => {
    const students = req.body;

    try {
        // Wrap the database operations in a promise to use async/await
        const updateStudent = (student) => {
            return new Promise((resolve, reject) => {
                const { Marks_Given, Status, ID } = student;

                const updatedata = `UPDATE Test_taken_child set Marks_Given = ? ,Status = ?  WHERE ID = ?`;

                con.query(updatedata, [Marks_Given, Status, ID], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        };

        // Iterate over all students and update each one
        for (const student of students) {
            await updateStudent(student);
        }

        res.status(200).json({ message: "Students data updated successfully" });
    } catch (err) {
        console.error("Error updating student data:", err);
        res.status(500).json({ error: "Error updating student data", details: err });
    }
});

app.post("/nodeapp/update_vivataken_child", async (req, res) => {
    const students = req.body;

    try {
        // Wrap the database operations in a promise to use async/await
        const updateStudent = (student) => {
            return new Promise((resolve, reject) => {
                const { Marks_Given, Status, ID } = student;

                console.log(Marks_Given);

                const updatedata = `UPDATE viva_taken_child set Marks_Given = ? ,Status = ?  WHERE ID = ?`;

                con.query(updatedata, [Marks_Given, Status, ID], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        };

        // Iterate over all students and update each one
        for (const student of students) {
            await updateStudent(student);
        }

        res.status(200).json({ message: "Students data updated successfully" });
    } catch (err) {
        console.error("Error updating student data:", err);
        res.status(500).json({ error: "Error updating student data", details: err });
    }
});
app.post("/nodeapp/update_fexamtaken_child", async (req, res) => {
    const students = req.body;

    try {
        // Wrap the database operations in a promise to use async/await
        const updateStudent = (student) => {
            return new Promise((resolve, reject) => {
                const { Marks_Given, Status, ID } = student;

                console.log(Marks_Given);

                const updatedata = `UPDATE Exam_taken_child set Marks_Given = ? ,Status = ?  WHERE ID = ?`;

                con.query(updatedata, [Marks_Given, Status, ID], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        };

        // Iterate over all students and update each one
        for (const student of students) {
            await updateStudent(student);
        }

        res.status(200).json({ message: "Students data updated successfully" });
    } catch (err) {
        console.error("Error updating student data:", err);
        res.status(500).json({ error: "Error updating student data", details: err });
    }
});

// app.post("/nodeapp/allocatedrollno", (req, res) => {
//     const { batch_Id} = req.body; // Access batch_code from the request body

//     const sqlSelect = `SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase FROM Student_Master as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id where sm.IsDelete = 0 and am.IsActive = 1 AND sm.Status_id = 8 AND am.Batch_Id = ?`;

//     const param = [batch_Id];

//     con.query(sqlSelect, param, (err, students) => {
//         if (err) {
//             return res.json(err);
//         }

//         // Sort students by Student_Name in ascending 


//         students.sort((a, b) => a.Student_Name.localeCompare(b.Student_Name));



//         // Extract and sort Student_Code in ascending order
//         const sortedCodes = students.map((student) => student.Student_Code).sort();



//         // Reassign sorted Student_Code back to sorted students
//         const updatedStudents = students.map((student, index) => ({
//             Student_Id: student.Student_Id,
//             Student_Code: sortedCodes[index], // Assign sorted codes in order
//         }));

//         // Prepare promises to update each student's Student_Code in the database
//         const updatePromises = updatedStudents.map((student) => {
//             return new Promise((resolve, reject) => {
//                 const sqlUpdate = "UPDATE Admission_master SET Student_Code = ? , IsDone = '1' WHERE Student_Id = ?";
//                 con.query(sqlUpdate, [student.Student_Code, student.Student_Id], (err, result) => {
//                     if (err) {
//                         reject(err);
//                     } else {
//                         resolve(result);
//                     }
//                 });
//             });
//         });

//         // Execute all update promises concurrently
//         Promise.all(updatePromises)
//             .then((results) => {
//                 res.json({ message: "Student codes reassigned successfully", results });
//             })
//             .catch((error) => {
//                 res.json({ error: "Error updating student codes", details: error });
//             });
//     });
// });

app.post("/nodeapp/allocatedrollno", (req, res) => {
    const { batch_Id, batch_Code } = req.body;

    const sqlSelect = `
        SELECT sm.Student_Id, sm.Student_Name, am.Admission_Date, am.Student_Code, am.Phase , bm.Batch_code
        FROM Student_Master sm 
        LEFT JOIN Admission_master am ON am.Student_Id = sm.Student_Id 
        LEFT JOIN Batch_Mst as bm on bm.Batch_Id = am.Batch_Id
        WHERE sm.IsDelete = 0 AND am.isDelete = 0 and  am.IsActive = 1 AND sm.Status_id = 8 AND am.Batch_Id = ?
    `;

    con.query(sqlSelect, [batch_Id], (err, students) => {
        if (err) return res.json(err);

        const Batchcode = students[0].Batch_code;

        // Sort by student name
        students.sort((a, b) => a.Student_Name.localeCompare(b.Student_Name));

        // Current year (last 2 digits)
        const year = new Date().getFullYear().toString().slice(2);

        // Start the count from current total + 1
        const sqlCount = `SELECT COUNT(*) as total FROM Admission_master WHERE Batch_Id = ? AND IsActive = 1`;
        con.query(sqlCount, [batch_Id], (err, result) => {
            if (err) return res.json({ error: "Error fetching student count", details: err });

            let existingCount = 0

            // Map new student codes
            const updatedStudents = students.map((student) => {
                existingCount++;
                const countStr = String(existingCount).padStart(4, '0');

                const studentCode = `${year}${Batchcode}${countStr}`;
                return {
                    Student_Id: student.Student_Id,
                    Student_Code: studentCode,
                };
            });

            // Prepare update promises
            const updatePromises = updatedStudents.map((student) => {
                return new Promise((resolve, reject) => {
                    const sqlUpdate = `
                        UPDATE Admission_master 
                        SET Student_Code = ?, IsDone = '1' 
                        WHERE Student_Id = ?
                    `;
                    con.query(sqlUpdate, [student.Student_Code, student.Student_Id], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            });

            Promise.all(updatePromises)
                .then((results) => {
                    res.json({ message: "Student codes reassigned successfully", updatedStudents });
                })
                .catch((error) => {
                    res.json({ error: "Error updating student codes", details: error });
                });
        });
    });
});


app.get("/nodeapp/generateresultdata", (req, res) => {
    const sql =
        "select gf.Id , bm.Batch_code ,cm.Course_Name , gf.Result_date ,fm.Faculty_Name from generate_final_result as gf left join Batch_Mst as bm on bm.Batch_Id = gf.Batch_Id left JOIN Course_Mst as cm on cm.Course_Id = gf.Course_Id left JOIN faculty_master as fm on fm.Faculty_Id = gf.Approve where gf.isDelete = 0 order by gf.Id desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post(`/nodeapp/getlecturedetails`, (req, res) => {
    let lectureid = req.body.lectureid;

    let sql = "select * from `Batch_SLecture_Master` where id = ?";

    con.query(sql, [lectureid], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getresultchild", (req, res) => {
    let Gen_id = req.body.Gen_id;

    const sql = "select * from `generate_final_child` where Gen_id = ? order by Student_Code";

    con.query(sql, [Gen_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getaddfeesdetailsdata", (req, res) => {
    const sql =
        "select fd.* , cm.Course_Name , bm.Batch_code from fees_details as fd left JOIN Course_Mst as cm on fd.Course_Id = cm.Course_Id LEFT JOIN Batch_Mst as bm on bm.Batch_Id = fd.Batch_Id where fd.isDelete = 0;";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getstudent_details", (req, res) => {
    let { Student_Id } = req.body;

    const sql =
        "select sm.Student_Name, sm.Student_Id ,sm.Present_Mobile,sm.Email,cm.Course_Name , sm.Course_Id,am.Batch_Id, bm.Batch_code,bm.Fees_Full_Payment from Student_Master as sm left JOIN Course_Mst as cm on sm.Course_Id = cm.Course_Id  left join Admission_master as am on am.Student_Id = sm.Student_Id  left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.Student_Id = ?";

    con.query(sql, [Student_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/gettime", (req, res) => {
    const sql = "select * from Timining_org";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});
app.get("/nodeapp/gettranferbatch", (req, res) => {
    const sql = "select Batch_code , Batch_Id from Batch_Mst where Category = 'Transfer' and IsDelete = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/importgrade", (req, res) => {
    let { batchid } = req.body;

    const sql = "SELECT * FROM standard_grades";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json({ success: false, message: "Error fetching standard grades", error: err });
        } else {
            // Iterate over the fetched grades and insert them into the `grades` table
            data.forEach((item) => {
                let { start_from, end_from, grade } = item;

                const insert =
                    "INSERT INTO grades(`batch_id`, `start_from`, `end_from`, `grade`, `deleted`) VALUES (?, ?, ?, ?, ?)";

                // Perform the insert query
                con.query(insert, [batchid, start_from, end_from, grade, 0], (err, result) => {
                    if (err) {
                        console.error("Error inserting grade:", err);
                        return res.json({ success: false, message: "Error inserting grade", error: err });
                    }
                });
            });

            // Send a response once all queries have been executed
            res.json({ success: true, message: "Grades imported successfully" });
        }
    });
});

// Convert Excel date serial to JavaScript Date
// const excelDateToJSDate = (excelDate) => {
//   const dateOffset = (excelDate - (25567 + 1)) * 86400 * 1000; // Days since 01-01-1970 in milliseconds
//   const date = new Date(dateOffset);
//   return date.toISOString().split('T')[0]; // Returns 'YYYY-MM-DD'
// };

// const excelDateToJSDate = (excelDate) => {
//   const dateOffset = (excelDate - (25567 + 1)) * 86400 * 1000; // Days since 01-01-1970 in milliseconds
//   return new Date(dateOffset);
// };

// app.post("/nodeapp/upload-excel", (req, res) => {

//   const excelData = req.body.data;
//   const batch_id = req.body.batch_id;
//   const date = new Date();

//   if (!excelData || excelData.length === 0) {
//     return res.status(400).json({ message: "No data to import" });
//   }

//   const sqlQuery = "INSERT INTO Batch_SLecture_Master (assignment, assignment_date, class_room,date,documents,duration,endtime,faculty_name,lecture_no,marks,publish,starttime,subject,subject_topic,unit_test,batch_id,created_date) VALUES ?";

//   const values = excelData.map((row) => [row.Assignment, excelDateToJSDate(row.Assignment_date), row.Class_room, excelDateToJSDate(row.Date), row.Documents, row.Duration, row.Endtime, row.Faculty_name, row.Lecture_no, row.Marks, row.Publish, row.Starttime, row.Subject, row.Subject_topic, row.Unit_test, batch_id, date]);

//   con.query(sqlQuery, [values], (err, result) => {
//     if (err) {
//       return res.status(500).json({ error: err });
//     } else {

//       const insertlecture = 'INSERT INTO batch_lecture_master (assignment, assignment_date, class_room,date,documents,duration,endtime,faculty_name,lecture_no,marks,publish,starttime,subject,subject_topic,unit_test,batch_id,created_date) VALUES ?';

//       const values = excelData.map((row) => [row.Assignment, excelDateToJSDate(row.Assignment_date), row.Class_room, excelDateToJSDate(row.Date), row.Documents, row.Duration, row.Endtime, row.Faculty_name, row.Lecture_no, row.Marks, row.Publish, row.Starttime, row.Subject, row.Subject_topic, row.Unit_test, batch_id, date]);

//       con.query(insertlecture, [values], (err, result) => {
//         if (err) {
//           return res.json(err)
//         } else {
//           return res.status(200).json(result)
//         }
//       })

//     }

//   });
// });

app.get("/nodeapp/getbatchleft", (req, res) => {
    const sql =
        "select ab.id , ab.batchno , ab.date,ab.reason, cm.Course_Name , sm.Student_Name from awt_batchleft as ab left join Course_Mst as cm on cm.Course_Id = ab.course LEFT JOIN Student_Master as sm on sm.Student_Id = ab.student  where ab.deleted = 0";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/getbatchcancellation", (req, res) => {
    const sql =
        "select ab.id , bm.Batch_code as batchno  , ab.date,ab.cancellationammount, cm.Course_Name , sm.Student_Name from awt_batchcancellation as ab left join Course_Mst as cm on cm.Course_Id = ab.course LEFT JOIN Student_Master as sm on sm.Student_Id = ab.student LEFT join Batch_Mst as bm on bm.Batch_Id = ab.batchno where ab.deleted = 0 order by ab.id desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

// app.post('/nodeapp/generatebatchcode', (req, res) => {

//   let { course_id, batchcat_id } = req.body;
//   let newbatchid;

//   if(batchcat_id == '1'){
//      newbatchid = '1,2,3,4'
//   }
//   else if(batchcat_id == '2'){
//       newbatchid = '1,2,3,4'
//   }
//   else if(batchcat_id == '3'){
//       newbatchid = '1,2,3,4'
//   }
//   else if(batchcat_id == '4'){
//       newbatchid = '1,2,3,4'
//   }

//   if (batchcat_id == '1' || batchcat_id == '2' || batchcat_id == '4' || batchcat_id == '6') {

//     const sql = "select * from Batch_Mst where Course_Id = ?  AND FIND_IN_SET(Batch_Category_id, ?)  ORDER by Batch_Id desc LIMIT 1"

//     con.query(sql, [course_id, newbatchid], (err, data) => {
//       if (err) {
//         return res.json(err)
//       } else {

//         let soCount = course_id; // Example value
//         let coursenum = soCount.toString().padStart(2, '0');

//         const batchcode = data[0].Batch_code;
//         let batchcount = Number(batchcode) + 1;
//         let batchnum = batchcount.toString().padStart(5, '0')

//         // const newBatchcode = coursenum + batchnum

//         return res.json({ batch_code: "922" })

//       }
//     })

//   } else if (batchcat_id == '3') {

//     const sql = 'select * from Batch_Mst where Course_Id = ? and Batch_Category_id = ? ORDER by Batch_Id desc LIMIT 1'

//     con.query(sql, [course_id, batchcat_id], (err, data) => {
//       if (err) {
//         return res.json(err)
//       } else {

//         const batchcode = data[0].Batch_code;
//         const datacount = Number(batchcode) + 1;
//         let datanum = datacount.toString().padStart(5, "0");

//         // let corCount = course_id;
//         // let coursenum = corCount.toString().padStart(2, '0');
//         // const newBatchcode = coursenum + batchcat_id + datanum

//           return res.json({ batch_code: "911" })

//       }
//     })
//   } else {

//     let corCount = course_id; // Example value
//     let lastcount = 0;

//     let count = lastcount.toString().padStart(4, '0')

//     const finalcount = corCount + count

//     return res.json({ batch_code: finalcount })

//   }

// })

app.post("/nodeapp/generatebatchcode", (req, res) => {
    const { course_id, batchcat_id } = req.body;

    let newbatchid = "1,2,4,6,3"; // Common batch IDs
    const queryForCategory1And2 = `
    SELECT * 
    FROM Batch_Mst 
    WHERE Course_Id = ? AND IsDelete = 0 and FIND_IN_SET(Batch_Category_id, ?) 
    ORDER BY Batch_Id DESC 
    LIMIT 1`;

    const queryForCategory3 = `
    SELECT * 
    FROM Batch_Mst 
    WHERE Course_Id = ? AND IsDelete = 0 AND  Batch_Category_id = ? 
    ORDER BY Batch_Id DESC 
    LIMIT 1`;

    if (["1", "2", "4", "6", "3"].includes(batchcat_id)) {
        con.query(queryForCategory1And2, [course_id, newbatchid], (err, data) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error fetching batch data." });
            }


            const batchCode = Number(data[0]?.Batch_code || 0) + 1;



            const batchNum = batchCode.toString().padStart(5, "0");
            return res.json({ batch_code: `${batchNum}` });
        });

    } else {
        const lastCount = 0;
        const batchNum = lastCount.toString().padStart(4, "0");
        return res.json({ batch_code: `${course_id}${batchNum}` });
    }
});

app.post("/nodeapp/add_taxdata", (req, res) => {
    let { user_id, uid, Tax, Tax_date } = req.body;
    const date = new Date();

    let sql;
    let param;

    if (uid == undefined) {
        sql = "insert into awt_tax(`Tax`,`Tax_date`,`created_date`,`created_by`) values(?,?,?,?)";
        param = [Tax, Tax_date, date, user_id];
    } else {
        sql = "update awt_tax set Tax = ? , Tax_date = ? , updated_date = ? , updated_by = ? where id = ?";
        param = [Tax, Tax_date, date, user_id, uid];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            if (data.insertId == 0) {
                return res.json("Data Updated");
            } else {
                return res.json("Data Inserted");
            }
        }
    });
});

app.post("/nodeapp/add_purchase_material", (req, res) => {
    let {
        company,
        item,
        purchase_date,
        purchase,
        vendor,
        purpose,
        purposetxt,
        batch_id,
        course_id,
        requireddate,
        price,
        quantity,
        totalamt,
        uid,
    } = req.body;

    const date = new Date();

    const formatedate = date.toISOString().slice(0, 10);

    let sql;
    let param;

    const getpurchase = "select COUNT(*) AS count from awt_purchase_material where deleted = 0";

    con.query(getpurchase, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            let comp;

            if (company == "suvidya") {
                comp = "SIT";
            } else {
                comp = "ATS";
            }

            const count = data[0].count + 1;
            //  comp = company.slice(0, 2)
            const vno = count.toString().padStart(4, "0");

            let voucherno = comp + "/" + formatedate + "/" + vno;

            if (uid == undefined) {
                sql =
                    "insert into awt_purchase_material(`item`,`vendor`,`price`,`company`,`purchase_date`,`purchase`,`voucherno`,`purpose`,`purposetxt`,`batch_id`,`course_id`,`requireddate`,`totalamt`,`quantity`,`created_date`) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
                param = [
                    item,
                    vendor,
                    price,
                    company,
                    purchase_date,
                    purchase,
                    voucherno,
                    purpose,
                    purposetxt,
                    batch_id,
                    course_id,
                    requireddate,
                    totalamt,
                    quantity,
                    date,
                ];
            } else {
                sql =
                    "update awt_purchase_material set item = ? , vendor = ? , price = ? , company = ? ,purchase_date =?,purchase = ?,purpose = ?,purposetxt = ?,batch_id = ?,course_id = ? ,requireddate = ? ,totalamt = ?,quantity = ?,updated_date = ?  where id = ?";
                param = [
                    item,
                    vendor,
                    price,
                    company,
                    purchase_date,
                    purchase,
                    purpose,
                    purposetxt,
                    batch_id,
                    course_id,
                    requireddate,
                    totalamt,
                    quantity,
                    date,
                    uid,
                ];
            }

            con.query(sql, param, (err, data) => {
                if (err) {
                    return res.json(err);
                } else {
                    if (data.insertId == 0) {
                        return res.json("Data Updated");
                    } else {
                        return res.json("Data Inserted");
                    }
                }
            });
        }
    });
});

app.get("/nodeapp/getpurchase", (req, res) => {
    const sql =
        "select apm.id , apm.price,apm.company ,apm.purchase_date,apm.voucherno,apm.purpose,apm.quantity ,apm.totalamt, amc.Category,avm.vendorname,fm.Faculty_Name  from awt_purchase_material as apm LEFT JOIN awt_material_cat as amc on amc.id = apm.item left JOIN awt_vendor_master as avm on avm.id = apm.vendor LEFT JOIN faculty_master as fm on fm.Faculty_Id = apm.id WHERE apm.deleted = 0 order by apm.id desc";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getStockReport", (req, res) => {
    const itemId = req.body.itemId

    let sqlPurchaseQty = `SELECT apm.id, apm.item, amc.Category, sum(apm.quantity) as total_purchase FROM awt_purchase_material as apm 
    left join awt_material_cat as amc on apm.item = amc.id where apm.deleted = 0 group by apm.item`

    let sqlConsumeQty = `Select selectitem, sum(qtyissue) as consume from awt_materialconsumption where deleted = 0 group by selectitem`

    let params = []

    if (itemId) {
        sqlPurchaseQty += " having item = ?"
        sqlConsumeQty += " having selectitem = ?"
        params.push(itemId)
    }

    con.query(sqlPurchaseQty, params, (err, purchaseData) => {
        if (err) {
            res.send({ err: 'database error' })
        } else {
            con.query(sqlConsumeQty, params, (err, consumeData) => {
                if (err) {
                    res.send({ err: "database error" })
                } else {
                    res.send({
                        purchaseData,
                        consumeData
                    })
                }
            })
        }
    })

})

app.post("/nodeapp/getfinalreport", (req, res) => {
    let { Batch_Id, Student_Id } = req.body;

    let sql;
    let param;

    if (Student_Id) {
        sql = "SELECT afc.* , bm.Batch_code , cm.Course_Name FROM generate_final_child as afc LEFT JOIN Batch_Mst as bm on bm.Batch_Id = afc.Batch_Id LEFT JOIN Course_Mst as cm on cm.Course_Id = bm.Course_Id WHERE afc.Student_Id = ? AND afc.deleted = 0 ORDER BY CAST(afc.Final_Result_Percent AS DECIMAL(10,2)) DESC";
        param = [Student_Id];
    } else {
        sql = "SELECT afc.* , bm.Batch_code , cm.Course_Name FROM generate_final_child as afc LEFT JOIN Batch_Mst as bm on bm.Batch_Id = afc.Batch_Id LEFT JOIN Course_Mst as cm on cm.Course_Id = bm.Course_Id WHERE afc.Batch_Id = ? AND afc.deleted = 0 ORDER BY CAST(afc.Final_Result_Percent AS DECIMAL(10,2)) DESC";
        param = [Batch_Id];
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.get(`/nodeapp/state`, (req, res) => {
    const sql = "select * from awt_states ";

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

// app.get('/nodeapp/getinquiry', async (req, res) => {


//       const client = new SendMailClient({ url, token });

//      const sql = "SELECT top 10 * from Student_Master"

//      con.qury(sql , (err,data) =>{
//          if(err){
//              return res.json(err)
//          }else{

//           const htmlbody = `
//           <html lang="en">

// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <link rel="preconnect" href="https://fonts.googleapis.com">
// <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
// <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
// <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
//     <title>Document</title>
//     <style>
//         body{
//             font-family: "Roboto", sans-serif;
//         }
//         p {
//             color: #335F9B;
//         }
//         .font600 {
//         font-weight: 600;
//         }
//         .m-0{
//             margin: 0px;
//         }
//         .color-light{
//         color: #4F81BD;
//         }
//         .last p{
//             font-size: 10px;
//         }
//     </style>
// </head>

// <body>
//     <p>Dear <b>Dattatray Vishnu Thakur,</b></p>
//     <p>Warm greetings from SIT!!!</p>
//     <p><b>Your admission form is accepted for MEP Engineering (Mechanical, Electrical & Plumbing) - 26027.</b></p>
//     <p>Please find the attach documents, request you to kindly read the same and send us the signed copy of it.</p>
//     <p>Kindly make the payment as earliest to confirm your admission</p>
//     <p><b>You can do the payment through NEFT; RTGS or you can directly deposit the cheque in our axis bank account</b></p>
//     <p style="text-decoration: underline;">Please find below bank details of SIT :</p>
//     <div style="display: flex;">
//         <p>Bank account name</p>
//         <p style="padding-left: 50px;">: Suvidya Institute of Technology Pvt. Ltd.</p>
//     </div>
//     <div style="display: flex;">
//         <p>Bank Name</p>
//         <p style="padding-left: 99px;">: Axis Bank Ltd.</p>
//     </div>
//     <div style="display: flex;">
//         <p>Branch Address</p>
//         <p style="padding-left: 74px;">: Vakola, Mumbai (MH), City Survey No. 841 to 846,<br>Florence Lorenace chs ltd. Mumbai 400055.</p>
//     </div>
//     <div style="display: flex;">
//         <p>Bank Account No</p>
//         <p style="padding-left: 62px;">: 911020002988600</p>
//     </div>
//     <div style="display: flex;">
//         <p>IFSC code for NEFT payment </p>
//         <p style="padding-left: 50px;">: UTIB0001244</p>
//     </div>
//     <div style="display: flex;">
//         <p>MICR Code</p>
//         <p style="padding-left: 100px;">: 400211082</p>
//     </div>
//     <div style="display: flex;">
//         <p>Swift Code</p>
//         <p style="padding-left: 106px;">: AXISINBB028</p>
//     </div>

//     <p>Mention your Reference no. (mentioned in subject of this mail)  in all correspondence.</p>

//     <p><b>Please find attached herewith Procedure & Rules & Regulation for your information.</b></p>
//     <p><b>Please mail us payment slip/bank payment advice after payment.  For any queries related to accounts, call on 022-61943120 or mail on</b><a  href="mailto:manasipanchal@suvidya.ac.in" style="text-decoration: underline;"> manasipanchal@suvidya.ac.in</a></p>

//     <p class="m-0 font600 color-light">Regards,</p>
//     <p class="m-0 font600 color-light">Jeena Fernandes</p>
//     <p class="m-0 font600 color-light">Sr. Executive Career Building Department</p>
//     <p class="m-0 font600 color-light">Mobile No: 9167219405</p>
//     <p class="m-0 font600 color-light">Tel: 91 022 26682295, 91 022 26682290 - Ext.101</p>

//     <div>
//         <p><a href="mailto:www.suvidya.ac.in ">www.suvidya.ac.in  </a>  |  <a href="mailto:www.accent.net.in">www.accent.net.in</a></p>

//         <p class=" font600 color-light">Follow Simple Rules – Change Food to Improve Immunity, Use Mask, Keep Safe Distance, use Sanitiser, Be Happy and Be Healthy.</p>
//         <p class=" font600 color-light">Print if it is very much necessary to support environment as one Kg paper need 10 litres of water.</p>
//         <p class=" font600 color-light">Disclaimer – Email contents are for your information only, if you do not wish to received then please feel free  to infrom us happily, will stop sending with immediate effect.</p>

//         <img style="width: 100px;" src="https://ci3.googleusercontent.com/meips/ADKq_NbsTBI0TbxWtHsgK4sZiEjQKNTdIHzy9jy8nKKE_9hmO0Wf6ofXFypOTD-0REzIfxiG23CcpvDEBSdVzxc-wEUDQ3IRel8=s0-d-e1-ft#http://sit.suvidya.ac.in/images/suvidya_logo.jpg" alt="">

//         <p style="font-size: 13px;"><b>Suvidya Institute of Technology Pvt. Ltd.</b></p>
//         <p style="font-size: 13px;"><b>An ISO 9001:2015 Certified Organisation by Bureau of Indian Standards</b></p>
//         <p style="font-size: 13px;margin-top: 30px;"><b>18/140,  Anand Nagar, Nehru Road, Vakola,</b></p>
//         <p style="font-size: 13px;"><b>Santacruz (East), Mumbai – 400 055.</b></p>

//         <div style="margin: 20px 0px;" class="last">
//           <p>Tel: 91 022 26682290 Ext.11, 16. Cell:9821569885</p>
//           <p>Email {Senderemail}</p>
//           <p>Website : <a href="https://www.suvidya.ac.in" target="_blank">www.suvidya.ac.in</a></p>

//         </div>

//         <p style="font-family: 'Satisfy', cursive;"><b>“Together we will bring new dimension to engineering industry”</b></p>

//     </div>

// </body>

// </html>
//         `;

//     await client.sendMail({
//       from: {
//         address: "noreply@sitsuvidya.in",
//         name: "noreply",
//       },
//       to: [
//         {
//           email_address: {
//             address: "yadneshnaidu77@gmail.com",
//             name: "Yadnesh",
//           },
//         },
//       ],
//       subject: "Customization Request Mail",
//       htmlbody,
//     });
//              return res.json(data)
//          }
//      })

// });

app.get('/nodeapp/test-mail', async (req, res) => {
    const client = new SendMailClient({ url, token });

    const htmlbody = `
   <html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
    <title>Document</title>
    <style>
        body{
            font-family: "Roboto", sans-serif;
        }
        p {
            color: #335F9B;
        }
        .font600 {
        font-weight: 600;
        }
        .m-0{
            margin: 0px;
        }
        .color-light{
        color: #4F81BD;
        }
        .last p{
            font-size: 10px;
        }
    </style>
</head>

<body>
    <p>Dear <b>Dattatray Vishnu Thakur,</b></p>
    <p>Warm greetings from SIT!!!</p>
    <p><b>Your admission form is accepted for MEP Engineering (Mechanical, Electrical & Plumbing) - 26027.</b></p>
    <p>Please find the attach documents, request you to kindly read the same and send us the signed copy of it.</p>
    <p>Kindly make the payment as earliest to confirm your admission</p>
    <p><b>You can do the payment through NEFT; RTGS or you can directly deposit the cheque in our axis bank account</b></p>
    <p style="text-decoration: underline;">Please find below bank details of SIT :</p>
    <div style="display: flex;">
        <p>Bank account name</p>
        <p style="padding-left: 100px;">: Suvidya Institute of Technology Pvt. Ltd.</p>
    </div>
    <div style="display: flex;">
        <p>Bank Name</p>
        <p style="padding-left: 148px;">: Axis Bank Ltd.</p>
    </div>
    <div style="display: flex;">
        <p>Branch Address</p>
        <p style="padding-left: 125px;">: Vakola, Mumbai (MH), City Survey No. 841 to 846,<br>Florence Lorenace chs ltd. Mumbai 400055.</p>
    </div>
    <div style="display: flex;">
        <p>Bank Account No</p>
        <p style="padding-left: 117px;">: 911020002988600</p>
    </div>
    <div style="display: flex;">
        <p>IFSC code for NEFT payment </p>
        <p style="padding-left: 46px;">: UTIB0001244</p>
    </div>
    <div style="display: flex;">
        <p>MICR Code</p>
        <p style="padding-left: 150px;">: 400211082</p>
    </div>
    <div style="display: flex;">
        <p>Swift Code</p>
        <p style="padding-left: 150px;">: AXISINBB028</p>
    </div>

    <p>Mention your Reference no. (mentioned in subject of this mail)  in all correspondence.</p>

    <p><b>Please find attached herewith Procedure & Rules & Regulation for your information.</b></p>
    <p><b>Please mail us payment slip/bank payment advice after payment.  For any queries related to accounts, call on 022-61943120 or mail on</b><a  href="mailto:manasipanchal@suvidya.ac.in" style="text-decoration: underline;"> manasipanchal@suvidya.ac.in</a></p>

    <p class="m-0 font600 color-light">Regards,</p>
    <p class="m-0 font600 color-light">Vaidehi Patankar</p>
    <p class="m-0 font600 color-light">Sr. Executive Career Building Department</p>
    <p class="m-0 font600 color-light">Mobile No: 9167219405</p>
    <p class="m-0 font600 color-light">Tel: 91 022 26682295, 91 022 26682290 - Ext.101</p>

    <div>
        <p><a href="mailto:www.suvidya.ac.in ">www.suvidya.ac.in  </a>  |  <a href="mailto:www.accent.net.in">www.accent.net.in</a></p>

        <p class=" font600 color-light">Follow Simple Rules – Change Food to Improve Immunity, Use Mask, Keep Safe Distance, use Sanitiser, Be Happy and Be Healthy.</p>
        <p class=" font600 color-light">Print if it is very much necessary to support environment as one Kg paper need 10 litres of water.</p>
        <p class=" font600 color-light">Disclaimer – Email contents are for your information only, if you do not wish to received then please feel free  to infrom us happily, will stop sending with immediate effect.</p>

        <img style="width: 100px;" src="https://ci3.googleusercontent.com/meips/ADKq_NbsTBI0TbxWtHsgK4sZiEjQKNTdIHzy9jy8nKKE_9hmO0Wf6ofXFypOTD-0REzIfxiG23CcpvDEBSdVzxc-wEUDQ3IRel8=s0-d-e1-ft#http://sit.suvidya.ac.in/images/suvidya_logo.jpg" alt="">

        <p style="font-size: 13px;"><b>Suvidya Institute of Technology Pvt. Ltd.</b></p>
        <p style="font-size: 13px;"><b>An ISO 9001:2015 Certified Organisation by Bureau of Indian Standards</b></p>
        <p style="font-size: 13px;margin-top: 30px;"><b>18/140,  Anand Nagar, Nehru Road, Vakola,</b></p>
        <p style="font-size: 13px;"><b>Santacruz (East), Mumbai – 400 055.</b></p>

        <div style="margin: 20px 0px;" class="last">
          <p>Tel: 91 022 26682290 Ext.11, 16. Cell:9821569885</p>
          <p>Email {Senderemail}</p>
          <p>Website : <a href="https://www.suvidya.ac.in" target="_blank">www.suvidya.ac.in</a></p>

        </div>

        <p style="font-family: 'Satisfy', cursive;"><b>“Together we will bring new dimension to engineering industry”</b></p>

    </div>

</body>

</html>
  `;

    try {


        const response = await axios.get('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', {
            responseType: 'arraybuffer',
        });

        const base64Pdf = Buffer.from(response.data, 'binary').toString('base64');


        await client.sendMail({
            from: {
                address: "noreply@sitsuvidya.in",
                name: "noreply",
            },
            to: [
                {
                    email_address: {
                        address: "satyamsatkr875@gmail.com",
                        name: "Satyam",
                    },
                },
            ],
            cc: [
                {
                    email_address: {
                        address: "patelabhishek19293@gmail.com",
                        name: "First CC",
                    },
                },
                {
                    email_address: {
                        address: "bhaveshdubey743@gmail.com",
                        name: "Second CC",
                    },
                }
            ],
            subject: `Confirmation: Admission Form Sent to Satyam`,
            htmlbody: htmlbody,
            attachments: [
                {
                    content: base64Pdf,
                    mime_type: "application/pdf",
                    name: "admission-form.pdf"
                }
            ]
        });





        res.json({
            message: "Mail sent successfully!"
        });
    } catch (error) {
        res.status(500).json({
            message: "Mail sending failed",
            error: error.message || error,
        });
    }
});

app.post("/nodeapp/inquirysendmail", async (req, res) => {
    const { email, inquiry, course } = req.body;

    const sql = `
        SELECT 
            si.Student_Name, 
            cm.Course_Name 
        FROM 
            Student_Inquiry AS si 
        LEFT JOIN 
            Course_Mst AS cm ON si.Course_Id = cm.Course_Id 
        LEFT JOIN 
            Student_Master AS sm ON si.Student_Id = sm.Student_Id 
        WHERE 
            si.Inquiry_Id = ?
    `;

    con.query(sql, [inquiry], async (err, data) => {
        if (err) {
            return res.status(500).json({ error: "Database error", details: err });
        }

        if (data.length === 0) {
            return res.status(404).json({ message: "Inquiry not found" });
        }

        const { Student_Name, Course_Name } = data[0];

        const htmlbody = `
          <html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
    <title>Document</title>
    <style>
        body{
            font-family: "Roboto", sans-serif;
        }
        p {
            color: #335F9B;
        }
        .font600 {
        font-weight: 600;
        }
        .m-0{
            margin: 0px;
        }
        .color-light{
        color: #4F81BD;
        }
        .last p{
            font-size: 10px;
        }
    </style>
</head>

<body>
   <p> Dear <b>${Student_Name}</b>,</p>

    <p>Thank you for your interest in our training programs at Suvidya Institute of Technology.</p>

    <h4>To proceed with the admission process, please complete the admission form using the link below:</h4>

    <a href="https://sitsuvidya.in/addmission_form.php?id=${inquiry}" target="_blank">https://sitsuvidya.in/addmission_form.php</a>

    <p>Once submitted, our team will review your application and guide you through the next steps.</p>

    <p>Should you have any questions, feel free to reach out.</p>

    <p>We look forward to being a part of your professional journey.</p>

    <p class="m-0 font600 color-light">Best regards,</p>

    <p class="m-0 font600 color-light">Vaidehi Patankar</p>
    <p class="m-0 font600 color-light">Sr. Executive Career Building Department</p>
    <p class="m-0 font600 color-light">Suvidya Institute of Technology Pvt. Ltd.</p>
    <p class="m-0 font600 color-light">Mobile No: 9167219405</p>
    <p class="m-0 font600 color-light">Tel: 91 022 26682295, 91 022 26682290 - Ext.101</p>

</body>

</html>
        `;

        const confirmationHtmlBody = `
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
                <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Satisfy&display=swap" rel="stylesheet">
                <title>Document</title>
                <style>
                    body{
                        font-family: "Roboto", sans-serif;
                    }
                    p {
                        color: #335F9B;
                    }
                    .font600 {
                    font-weight: 600;
                    }
                    .m-0{
                        margin: 0px;
                    }
                    .color-light{
                    color: #4F81BD;
                    }
                    .last p{
                        font-size: 10px;
                    }
                </style>
            </head>

            <body>
                <p>Dear Vaidehi Patankar,</p>

                <p>This is to confirm that the admission form has been successfully sent to the following student:</p>

                <p>Student Name: ${Student_Name}</p>
                <p>Email: ${email}</p>
                <p>Inquiry ID: ${inquiry}</p>
                <p>Course Interested: ${Course_Name}</p>
                
                <p>Best regards,</p>
                <p>Suvidya Institute of Technology Pvt. Ltd.</p>
            </body>
        </html>
    `;

        try {
            const client = new SendMailClient({ url, token });


            // await client.sendMail({
            //     from: {
            //         address: "noreply@sitsuvidya.in",
            //         name: "noreply",
            //     },
            //     to: [
            //         {
            //             email_address: {
            //                 address: email,
            //                 name: Student_Name,
            //             },
            //         },
            //     ],
            //     // cc: [
            //     //     {
            //     //         email_address:
            //     //         {
            //     //             address: "vaidehipatankar@suvidya.ac.in",
            //     //             name: "Jeena Fernandes" ,
            //     //         },
            //     //     },
            //     // ],
            //     subject: "Admission Form",
            //     htmlbody,
            // });

            await client.sendMail({
                from: {
                    address: "noreply@sitsuvidya.in",
                    name: "noreply",
                },
                to: [
                    {
                        email_address: {
                            address: email,
                            name: Student_Name,
                        },
                    },
                ],
                cc: [
                    {
                        email_address: {
                            address: "vaidehipatankar@suvidya.ac.in",
                            name: "Vaidehi Patankar",
                        },
                    },
                    {
                        email_address: {
                            address: "santoshmestry@suvidya.ac.in",
                            name: "Santosh Mestry",
                        },
                    }
                ],
                subject: `Admission Form`,
                htmlbody: htmlbody,
            });




            // await client.sendMail({
            //     from: {
            //         address: "noreply@sitsuvidya.in",
            //         name: "noreply",
            //     },
            //     to: [
            //         {
            //             email_address: {
            //                 address: "vaidehipatankar@suvidya.ac.in",
            //                 name: "Jeena Fernandes",
            //             },
            //         },
            //     ],
            //     subject: `Confirmation: Admission Form Sent to ${Student_Name}`,
            //     htmlbody: confirmationHtmlBody,
            // });

            res.status(200).json({ message: "Email sent successfully" });
        } catch (mailError) {
            res.status(500).json({ error: "Email sending failed", details: mailError });
        }
    });
});

// Student master excel upload

const excelDateToJSDate = (excelDate) => {
    const dateOffset = (excelDate - (25567 + 1)) * 86400 * 1000; // Days since 01-01-1970 in milliseconds
    const date = new Date(dateOffset);

    // Format the date to YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // getMonth() is 0-based
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

app.post("/nodeapp/upload-student-excel", (req, res) => {
    const excelData = req.body.data;
    const currentDate = new Date();

    if (!excelData || excelData.length === 0) {
        return res.status(400).json({ message: "No data to import" });
    }

    const sqlQuery = `
    INSERT INTO Student_Master_Dummy
    (Student_Id, FName, LName, MName, Student_Name, Qualification, Course_Id, DOB, Sex, Nationality, Region, 
     Present_Address, Present_City, Present_Pin, Present_State, Present_Country, Present_Tel, Present_Mobile, 
     Present_Mobile2, Fax, Permanent_Address, Permanent_City, Permanent_Pin, Permanent_State, Permanent_Country, 
     Permanent_Tel, Email, Other_Training, AutoCad, MicroStation, PDS, PDMS, Others, Occupation, Company, 
     Designation, Company_Add, Company_Tel, Design_Exp, Construction_Exp, Production_Exp, Marketing_Exp, 
     Other_Exp, Total_Exp, Pass_No, Pass_Issue_Dt, Pas_Exp_Dt, Known_Stud, Known_Web, Known_Paper, Known_Other, 
     Refered_By, Inquiry, Student, Inquiry_From, Inquiry_Type, Discussion, Inquiry_Dt, Date_Added, 
     Aca_Qualification, Discipline, Institute, Year, Marks, Batch_Code, DNC, Part_Time, Ex_Student, Photo, Quali, 
     Resi, Contract, Marksheet, Address, Admission, JobRequired, Remark, CVDate, SitPerformance, 
     PlacementRemark, Accomodation, Placement_Block, college_id, Admission_Dt, Father_Name, Father_Occupation, 
     Father_Mobile, Mother_Name, Mother_Occupation, Mother_Mobile, Sibling_Name, Sibling_Occupation, 
     Sibling_Mobile, online_stud_id, StateChangeDt, OnlineState, Percentage, Adm_DNC, IsActive, IsDelete, 
     IsUnread, IsUnreadAdm, Login_Id, Login_Password, Area_Of_Interest, Notice_Period, Industry, Salary, 
     Business_Nature, Company_city, IsAdmOpen, Placement_Type, Batch_Category_id, Nickname, Status_id, 
     Status_date, Expected_Location, Company_id, EncStudentId, GCMID, IMEI, EncUpdateDate)
    VALUES ?;
  `;

    const values = excelData.map((row) => [
        row.Student_Id,
        row.FName,
        row.LName,
        row.MName,
        row.Student_Name,
        row.Qualification,
        row.Course_Id,
        excelDateToJSDate(row.DOB) || null,
        row.Sex,
        row.Nationality,
        row.Region,
        row.Present_Address,
        row.Present_City,
        row.Present_Pin,
        row.Present_State,
        row.Present_Country,
        row.Present_Tel,
        row.Present_Mobile,
        row.Present_Mobile2,
        row.Fax,
        row.Permanent_Address,
        row.Permanent_City,
        row.Permanent_Pin,
        row.Permanent_State,
        row.Permanent_Country,
        row.Permanent_Tel,
        row.Email,
        row.Other_Training,
        row.AutoCad,
        row.MicroStation,
        row.PDS,
        row.PDMS,
        row.Others,
        row.Occupation,
        row.Company,
        row.Designation,
        row.Company_Add,
        row.Company_Tel,
        row.Design_Exp,
        row.Construction_Exp,
        row.Production_Exp,
        row.Marketing_Exp,
        row.Other_Exp,
        row.Total_Exp,
        row.Pass_No,
        excelDateToJSDate(row.Pass_Issue_Dt) || null,
        excelDateToJSDate(row.Pas_Exp_Dt) || null,
        row.Known_Stud,
        row.Known_Web,
        row.Known_Paper,
        row.Known_Other,
        row.Refered_By,
        row.Inquiry,
        row.Student,
        row.Inquiry_From,
        row.Inquiry_Type,
        row.Discussion,
        excelDateToJSDate(row.Inquiry_Dt) || null,
        currentDate,
        row.Aca_Qualification,
        row.Discipline,
        row.Institute,
        row.Year,
        row.Marks,
        row.Batch_Code,
        row.DNC,
        row.Part_Time,
        row.Ex_Student,
        row.Photo,
        row.Quali,
        row.Resi,
        row.Contract,
        row.Marksheet,
        row.Address,
        row.Admission,
        row.JobRequired,
        row.Remark,
        excelDateToJSDate(row.CVDate) || null,
        row.SitPerformance,
        row.PlacementRemark,
        row.Accomodation,
        row.Placement_Block,
        row.college_id,
        excelDateToJSDate(row.Admission_Dt) || null,
        row.Father_Name,
        row.Father_Occupation,
        row.Father_Mobile,
        row.Mother_Name,
        row.Mother_Occupation,
        row.Mother_Mobile,
        row.Sibling_Name,
        row.Sibling_Occupation,
        row.Sibling_Mobile,
        row.online_stud_id,
        excelDateToJSDate(row.StateChangeDt) || null,
        row.OnlineState,
        row.Percentage,
        row.Adm_DNC,
        row.IsActive,
        row.IsDelete,
        row.IsUnread,
        row.IsUnreadAdm,
        row.Login_Id,
        row.Login_Password,
        row.Area_Of_Interest,
        row.Notice_Period,
        row.Industry,
        row.Salary,
        row.Business_Nature,
        row.Company_city,
        row.IsAdmOpen,
        row.Placement_Type,
        row.Batch_Category_id,
        row.Nickname,
        row.Status_id,
        excelDateToJSDate(row.Status_date) || null,
        row.Expected_Location,
        row.Company_id,
        row.EncStudentId,
        row.GCMID,
        row.IMEI,
        excelDateToJSDate(row.EncUpdateDate) || null,
    ]);

    con.query(sqlQuery, [values], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        return res.json({ message: "Data inserted successfully", result });
    });
});

app.post("/nodeapp/getbatchcategorywise", (req, res) => {
    let { course_id, category_id } = req.body;

    const sql =
        "select * from Batch_Mst where Course_Id = ? and Batch_Category_id = ? and isDelete = 0 and isActive = 1";

    con.query(sql, [course_id, category_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getupcominhgbatch", (req, res) => {
    let { course_id, category_id } = req.body;

    // const current_date = new Date().toISOString().split('T')[0]; 

    const today = new Date();
    const year = today.getFullYear();
    const isBeforeApril = today.getMonth() < 3;
    const startYear = isBeforeApril ? year - 1 : year;
    const endYear = isBeforeApril ? year : year + 1;

    // Format the dates as YYYY-MM-DD
    const fromDate = `${startYear}-04-01`;
    const toDate = `${endYear}-03-31`;


    const sql = "select * from Batch_Mst where Course_Id = ? and Batch_Category_id = ? and SDate BETWEEN ? and ? and isDelete = 0 and isActive = 1";

    con.query(sql, [course_id, category_id, fromDate, toDate], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});



//This is for disscussion modify
app.get("/nodeapp/discussion_fix", (req, res) => {
    const getInquiry = "SELECT Student_Id,Inquiry_Id FROM Student_Inquiry ";

    con.query(getInquiry, (err, inquiries) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching inquiries", details: err });
        }

        if (inquiries.length === 0) {
            return res.status(404).json({ message: "No inquiries found" });
        }

        // Array to track status of all updates
        let results = [];
        let errors = [];
        let processed = 0;

        inquiries.forEach((item) => {
            let { Student_Id, Inquiry_Id } = item;

            const sql = `
                UPDATE awt_inquirydiscussion
                SET Inquiry_Id = ?
                WHERE Student_Id = ? AND (Inquiry_Id IS NULL OR Inquiry_Id = 0)
                LIMIT 100
            `;

            con.query(sql, [Inquiry_Id, Student_Id], (updateErr, updateResult) => {
                processed++;

                if (updateErr) {
                    errors.push({ Student_Id, Inquiry_Id, error: updateErr });
                } else {
                    results.push({ Student_Id, Inquiry_Id, affectedRows: updateResult.affectedRows });
                }

                // Respond after processing all inquiries
                if (processed === inquiries.length) {
                    if (errors.length > 0) {
                        res.status(500).json({
                            message: "Partial success",
                            errors,
                            results,
                        });
                    } else {
                        res.json({
                            message: "All updates successful",
                            results,
                        });
                    }
                }
            });
        });
    });
});

app.get("/nodeapp/update_inquiry_admission", (req, res) => {
    const sql = "SELECT Student_Id, Status_id FROM `Student_Master` WHERE Status_id = 8";

    con.query(sql, (err, students) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching students", details: err });
        }

        // Prepare promises for all updates
        const updatePromises = students.map((student) => {
            const { Student_Id } = student;
            const updateSql = "UPDATE Student_Inquiry SET Admission = 1 WHERE Student_Id = ?";

            return new Promise((resolve, reject) => {
                con.query(updateSql, [Student_Id], (err, result) => {
                    if (err) {
                        reject(err); // Reject promise if an error occurs
                    } else {
                        resolve(result); // Resolve promise with result
                    }
                });
            });
        });

        // Wait for all update promises to complete
        Promise.all(updatePromises)
            .then((results) => {
                res.json({ message: "All inquiries updated successfully", results });
            })
            .catch((error) => {
                res.status(500).json({ error: "Error updating inquiries", details: error });
            });
    });
});

app.post("/nodeapp/importstudenttime", async (req, res) => {
    const { data } = req.body;

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
    const day = String(date.getDate()).padStart(2, "0");

    const currentdate = `${year}-${month}-${day}`; // Ensure proper date format (YYYY-MM-DD)

    const url = `http://172.16.1.40:84/api/v2/WebAPI/GetDeviceLogs?APIKey=575714112428&FromDate=${currentdate}&ToDate=${currentdate}`;

    try {
        // Fetch data from the API
        const response = await axios.get(url);

        // Respond with the API data
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error fetching data:", error.message);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});


app.get("/nodeapp/getsmsapi", async (req, res) => {

    let ticket_no = 'SH234';
    let otp = '1234';
    let mobile = '9326476448'



    const username = "LIEBHERR";
    const password = "Liebh@01";
    const temp_id = '1207173530305447084'


    const msg = encodeURIComponent(
        `Dear Customer, Greetings from Liebherr! Your Ticket Number is ${ticket_no}. Please share OTP ${otp} with the engineer once the ticket is resolved.`
    );

    const apiUrl = `https://smsgw.tatatel.co.in:9095/campaignService/campaigns/qs?recipient=${mobile}&dr=false&msg=${msg}&user=${username}&pswd=${password}&sender=LICARE&PE_ID=1201159257274643113&Template_ID=${temp_id}`;

    try {
        const response = await axios.get(apiUrl); // Remove httpsAgent unless absolutely needed
        if (response.data) {
            return res.json({ message: "Success", data: response.data });
        }
    } catch (error) {
        console.error('Error hitting SMS API:', error.response?.data || error.message);
        return res.status(500).json({ message: 'Failed to send SMS', error: error.message });
    }
});


app.post("/nodeapp/getFeesdetailspdf", (req, res) => {
    let { Fees_Id } = req.body;
    const { page = 0, pageSize = 10 } = req.body; // Default values if page or pageSize are not provided

    // Calculate the offset for pagination
    const offset = page * pageSize;
    const sql =
        "SELECT f.Payment_Type,f.Amount,f.Amt_Word,f.Date_Added,f.Fees_Code,s.Student_Name,c.Course_Name FROM S_Fees_Mst as f LEFT JOIN Student_Master as s on s.Student_Id = f.Student_Id LEFT JOIN Course_Mst as c on c.Course_Id = f.Course_Id WHERE f.Fees_Id = ?";
    con.query(sql, [Fees_Id], (err, data) => {
        if (err) {
            return res.status(500).json({ error: "Database error", details: err });
        } else {
            return res.json(data);
        }
    });
});

app.get("/nodeapp/generatereceiptnumber", (req, res) => {
    const sql = `
        SELECT RIGHT(Fees_Code, 3) as Count 
        FROM S_Fees_Mst 
        WHERE MONTH(Date_Added) = MONTH(CURRENT_DATE()) 
          AND YEAR(Date_Added) = YEAR(CURRENT_DATE()) 
        ORDER BY Fees_Code DESC 
        LIMIT 1
    `;

    con.query(sql, (err, data) => {
        if (err) {
            return res.status(500).json({ error: "Database error", details: err });
        } else {
            const count = data.length ? Number(data[0].Count) + 1 : 1;

            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
            const year = now.getFullYear(); // YYYY

            const paddedCount = String(count).padStart(3, '0'); // e.g. "001"
            const receipt_no = `R-${month}/${paddedCount}`;

            return res.json({ receipt_no });
        }
    });
});
app.get("/nodeapp/updatestudentstatus", (req, res) => {
    const selectSql = `SELECT * FROM Studet_Id`; // Assuming Student_Id is a table

    con.query(selectSql, (err, data) => {
        if (err) {
            return res.status(500).json({ error: "Database error", details: err });
        }

        let studentIds = [];
        let updateCount = 0;
        const statusToUpdate = 8; // or get it from req.query or req.body

        if (data.length === 0) {
            return res.json({ message: "No student IDs found." });
        }

        for (const row of data) {
            studentIds.push(row.Student_Id);
            const updateSql = `UPDATE Student_Master SET Status_id = ? WHERE Student_Id = ?`;

            con.query(updateSql, [statusToUpdate, row.Student_Id], (err, result) => {
                if (err) {
                    console.error(`Error updating Student_Id ${row.Student_Id}:`, err);
                    return; // skip to next iteration
                }

                updateCount++;

                // Send response only after all updates are done
                if (updateCount === data.length) {
                    return res.json({ updated: updateCount, studentIds });
                }
            });
        }
    });
});

app.post("/nodeapp/add_corporateinquiry", (req, res) => {
    let {
        Fname = '',
        MName = '',
        Lname = '',
        Course_Id,
        Mobile,
        Phone,
        Email,
        business,
        CompanyName,
        Designation,
        Remark,
        Address,
        State,
        City,
        Pin,
        Place,
        Country,
        Idate,
        u_id,
    } = req.body;

    // Construct FullName in the order: Lname Fname MName
    const FullName = `${Lname?.trim() || ''} ${Fname?.trim() || ''} ${MName?.trim() || ''}`.trim();

    let sql;
    let param;

    if (u_id === undefined) {
        // Duplicate check for INSERT
        const duplicateCheckSql = "SELECT * FROM Corporate_Inquiry WHERE Mobile = ? AND Email = ?";
        con.query(duplicateCheckSql, [Mobile, Email], (err, result) => {
            if (err) return res.json(err);

            if (result.length > 0) {
                return res.status(409).json("Duplicate Inquiry");
            }

            sql = `INSERT INTO Corporate_Inquiry 
                (Fname, MName, Lname, FullName, Course_Id, Mobile, Phone, Email, business, CompanyName, Designation, Remark, Address, State, City, Pin, Place, Country,Idate) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            param = [Fname, MName, Lname, FullName, Course_Id, Mobile, Phone, Email, business, CompanyName, Designation, Remark, Address, State, City, Pin, Place, Country, Idate];

            con.query(sql, param, (err, data) => {
                if (err) return res.json(err);
                return res.json("Data Inserted");
            });
        });
    } else {
        // Update flow with conditional duplicate check
        const getOriginalSql = "SELECT Mobile, Email FROM Corporate_Inquiry WHERE id = ?";
        con.query(getOriginalSql, [u_id], (err, originalResult) => {
            if (err) return res.json(err);

            if (originalResult.length === 0) {
                return res.status(404).json("Record not found");
            }

            const original = originalResult[0];

            // Check only if Mobile or Email has changed
            if (original.Mobile !== Mobile || original.Email !== Email) {
                const duplicateCheckSql = "SELECT * FROM Corporate_Inquiry WHERE Mobile = ? AND Email = ? AND id != ?";
                con.query(duplicateCheckSql, [Mobile, Email, u_id], (err, result) => {
                    if (err) return res.json(err);

                    if (result.length > 0) {
                        return res.status(409).json("Duplicate Inquiry");
                    }

                    // Perform update if no duplicates
                    performUpdate();
                });
            } else {
                // No change in Mobile or Email, safe to update
                performUpdate();
            }

            // Update logic
            function performUpdate() {
                const sql = `UPDATE Corporate_Inquiry 
                    SET Fname = ?, MName = ?, Lname = ?, FullName = ?, Course_Id = ?, Mobile = ?, Phone = ?, 
                        Email = ?, business = ?, CompanyName = ?, Designation = ?, Remark = ?,
                        Address = ?, State = ?, City = ?, Pin = ?, Place = ?, Country = ? ,Idate = ?
                    WHERE id = ?`;

                const param = [Fname, MName, Lname, FullName, Course_Id, Mobile, Phone, Email, business, CompanyName, Designation, Remark, Address, State, City, Pin, Place, Country, Idate, u_id];

                con.query(sql, param, (err, data) => {
                    if (err) return res.json(err);
                    return res.json("Data Updated");
                });
            }
        });
    }
});

app.post("/nodeapp/getplacementdetails", (req, res) => {
    const { Student_id } = req.body;

    if (!Student_id) {
        return res.status(400).json({ message: "Student_id is required" });
    }

    const sql = `
        SELECT 
            cc.PlacedBy,
            cs.CompanyName,
            cs.TDate,
            cc.Remark,
            cc.Sended,
            cc.Placement
        FROM 
            CVChild AS cc
        LEFT JOIN 
            CV_Shortlisted AS cs 
        ON 
            cs.id = cc.CV_Id
        WHERE 
            cc.Student_Id = ?
        ORDER BY 
            cs.TDate DESC
    `;

    con.query(sql, [Student_id], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        res.json(result);
    });
});

app.post("/nodeapp/getStudentExcel", (req, res) => {
    const batchId = req.body.batchId; // <-- fix here

    if (!batchId) {
        return res.status(400).json({ error: "batchId is required" });
    }

    const sql = `
        SELECT DISTINCT 
            sm.Student_Name AS Student_Name,
            sm.Email AS Email,
            sm.Present_Mobile AS Present_Mobile
        FROM 
            abhishek_sit.Admission_master AS am
        LEFT JOIN 
            abhishek_sit.Student_Master AS sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN 
            abhishek_sit.Status_Master AS stm ON stm.Id = sm.Status_id
        LEFT JOIN 
            abhishek_sit.Batch_Mst AS bm ON bm.Batch_Id = am.Batch_Id
        WHERE 
            am.IsDelete = 0 AND 
            am.IsActive = 1 AND 
            sm.Status_id = 8 AND 
            am.Batch_Id = ?
    `;

    con.query(sql, [batchId], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }

        return res.json(result);
    });
});

app.post("/nodeapp/getStudentplacementreport", (req, res) => {
    const { Batch_Id } = req.body;

    if (!Batch_Id) {
        return res.status(400).json({ error: "Batch_Id  is required" });
    }

    const sql = `
        SELECT 
    ltm.Take_Dt, 
    ltc.Student_Name, 
    ltm.Lecture_Start, 
    ltm.Lecture_End,
    ltm.Batch_Id,  
    ltc.Student_Atten, 
    ltc.Late
FROM 
    lecture_taken_master AS ltm
LEFT JOIN 
    Lecture_taken_child AS ltc 
    ON ltm.Take_Id = ltc.Take_Id
LEFT JOIN 
    Student_Master as sm 
    ON ltc.Student_Id  = sm.Student_Id
WHERE 
   ltm.IsDelete     = 0 
   AND sm.IsActive = 1
   AND ltm.Batch_Id = ?
GROUP BY 
    ltm.Take_Dt, ltm.Lecture_Start, ltm.Lecture_End, ltc.Student_Name
ORDER BY 
     ltm.Take_Dt ASC, ltc.Student_Name ASC;

    `;

    con.query(sql, [Batch_Id], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }

        return res.json(result);
    });
});

app.post("/nodeapp/getbatchIdstudent", (req, res) => {
    const { Batch_Id } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM `Student_Master` as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.batch_Id =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        "SELECT DISTINCT  sm.Student_Id,sm.Student_Name,Student_Code FROM Admission_master as am LEFT JOIN Student_Master as sm ON sm.Student_Id = am.Student_Id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id  WHERE am.IsDelete = 0 AND am.IsActive = 1 AND sm.Status_id = 8 AND bm.Batch_Id = ? ORDER BY sm.Student_Name ASC";

    con.query(sql, [Batch_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/get_book_data", (req, res) => {
    let tablename = req.body.tablename;
    let columnname = req.body.columnname;

    const sql = `select ${columnname} from ${tablename} where isDelete = 0 ORDER BY Book_Name `;

    con.query(sql, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/get_bookissuedata", (req, res) => {
    let tablename = req.body.tablename;
    let columnname = req.body.columnname;

    if (columnname == undefined) {
        const sql = `select * from ${tablename} ORDER BY Issue_Id DESC `;

        con.query(sql, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    } else {
        const sql = `select ${columnname} from ${tablename} ORDER BY Issue_Id DESC `;

        con.query(sql, (err, data) => {
            if (err) {
                return res.json(err);
            } else {
                return res.json(data);
            }
        });
    }
});

app.post("/nodeapp/getlectureplanreport", (req, res) => {
    const { batch_code } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM Student_Master as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.batch_Id =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        `SELECT lm.Lecture_Start, lm.Lecture_End, lm.Take_Dt, lm.Topic, sm.lecture_no, sm.starttime, sm.endtime, sm.lectureday, sm.planned, bm.Batch_code, bm.Category, sm.documents, fm.Faculty_Name, cm.Course_Name FROM lecture_taken_master AS lm LEFT JOIN Batch_SLecture_Master AS sm ON sm.id = lm.Lecture_Id LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = lm.Batch_Id LEFT JOIN faculty_master as fm on fm.Faculty_Id = lm.Faculty_Id LEFT JOIN Course_Mst as cm on cm.Course_Id = lm.Course_Id WHERE lm.IsDelete = 0 AND lm.IsActive = 1 AND bm.Batch_code = ? ORDER BY lm.Take_Id ASC`;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getcorporateinquiryreport", (req, res) => {
    const { Course_Id, fromdate, todate } = req.body;

    if (!Course_Id || !fromdate || !todate) {
        return res.status(400).json({ error: "Course_Id, StartYear, and EndYear are required." });
    }


    const sql = `
        SELECT cm.Course_Name, c.CompanyName, c.FullName, c.Designation, c.Place, c.business, c.Idate, c.Remark FROM Corporate_Inquiry as c LEFT JOIN Course_Mst as cm ON cm.Course_Id = c.Course_Id WHERE cm.Course_Id = ? AND c.Idate BETWEEN ? AND ?
    `;

    con.query(sql, [Course_Id, fromdate, todate], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getsessionreport", (req, res) => {
    const { batch_code } = req.body;

    //   const sql = "SELECT sm.Student_Id,sm.Student_Name , am.Admission_Date,am.Student_Code , am.Phase , am.IsDone FROM Student_Master as sm left JOIN Admission_master as am on am.Student_Id = sm.Student_Id left join Batch_Mst as bm on bm.Batch_Id = am.Batch_Id where sm.IsDelete = 0 AND am.IsDelete = 0 AND bm.batch_Id =  ? ORDER BY sm.Student_Name ASC"
    const sql =
        `SELECT cm.Course_Name, sm.starttime, sm.endtime, sm.lecture_no, lm.Topic FROM Batch_SLecture_Master AS sm LEFT JOIN lecture_taken_master as lm ON lm.Lecture_Id = sm.id LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = sm.batch_id LEFT JOIN Course_Mst AS cm ON cm.Course_Id = bm.Course_Id WHERE bm.Batch_code = ? ORDER BY sm.lecture_no ASC`;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getonlinestudentreport", (req, res) => {
    const { Course_Id, fromdate, todate, admission } = req.body;

    if (!Course_Id || !fromdate || !todate || !admission) {
        return res.status(400).json({ error: "Course_Id, fromdate, todate and admission  are required." });
    }


    const sql = `
      WITH LatestStudentDiscussion AS ( SELECT si.Student_Id, id.discussion, ROW_NUMBER() OVER (PARTITION BY si.Student_Id ORDER BY id.id DESC) AS rn FROM Student_Inquiry si JOIN awt_inquirydiscussion id ON id.Inquiry_id = si.Inquiry_Id ) SELECT bm.Course_Name, sm.Student_Id, sm.Student_Name, sm.Email, sm.Present_Mobile, stm.Status, lsd.discussion, sm.Status_date FROM Student_Master sm LEFT JOIN Course_Mst bm ON bm.Course_Id = sm.Course_Id LEFT JOIN Status_Master stm ON stm.Id = sm.Status_id LEFT JOIN ( SELECT Student_Id, discussion FROM LatestStudentDiscussion WHERE rn = 1 ) lsd ON lsd.Student_Id = sm.Student_Id WHERE sm.IsDelete = 0 AND sm.IsActive = 1 AND sm.Course_Id = ? AND stm.Id = ? AND sm.Status_date BETWEEN ? AND ? ORDER BY sm.Student_Name ASC
    `;

    con.query(sql, [Course_Id, admission, fromdate, todate], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getcollegefollowereport", (req, res) => {
    const { college, fromdate, todate, city, purpose } = req.body;

    if (!college || !fromdate || !todate || !city || !purpose) {
        return res.status(400).json({ error: "College_Id, fromdate, todate and admission  are required." });
    }


    const sql = `
      SELECT 
    cf.CName,
    cf.Phone,
    cf.Email,
    cf.Designation,
    cf.Purpose,
    cf.DirectLine,
    cf.Discipline,
    cf.Remark,
    cf.Tdate,
    ac.college_name
FROM 
    College_Follows AS cf
LEFT JOIN 
    awt_college AS ac ON ac.id = cf.College_id
WHERE 
    cf.IsDelete = 0 
    AND cf.College_id = ?
    AND ac.city = ?
    AND cf.Purpose = ?
    AND cf.Tdate BETWEEN ? AND ?
    `;

    con.query(sql, [college, city, purpose, fromdate, todate], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getbatchwiseassignreport", (req, res) => {
    const { batch_code } = req.body;
    if (!batch_code) {
        return res.status(400).json({ error: "Batch ID is required" });
    }
    const sql = `SELECT at.id,at.assignmentname,bm.Batch_code FROM assignmentstaken as at LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = at.batch_id WHERE bm.Batch_code = ${batch_code}`;


    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/testtakenpdf", (req, res) => {
    const { batch_code, Test_Id } = req.body;
    if (!batch_code || !Test_Id) {
        return res.status(400).json({ error: "Batch ID AND Test ID  is required" });
    }
    const sql = `
   SELECT 
    (@rownum := @rownum + 1) AS 'index',
    sorted.Test_Dt,
    sorted.Batch_code,
    sorted.Course_Name,
    sorted.Student_Name,
    sorted.Marks_Given,
    sorted.Marks_from,
    sorted.subject
FROM (
    SELECT  
        tm.Test_Dt,
        bm.Batch_code,
        cm.Course_Name,
        tc.Student_Name,
        tc.Marks_Given,
        tc.Marks_from,
        ut.subject
    FROM Test_taken_child AS tc
    LEFT JOIN Test_taken_master AS tm ON tm.Take_Id = tc.Take_Id
    LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = tm.Batch_Id
    LEFT JOIN Course_Mst AS cm ON cm.Course_Id = tm.Course_Id
    LEFT JOIN awt_unittesttaken AS ut ON ut.id = tm.Test_Id
    WHERE 
        bm.Batch_code = ? 
        AND tm.Test_Id = ?
    ORDER BY tc.Student_Name ASC
) AS sorted,
(SELECT @rownum := 0) AS r

   `;


    con.query(sql, [batch_code, Test_Id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getbatchwisesubjectdropdown", (req, res) => {
    const { batch_code } = req.body;

    if (!batch_code) {
        return res.status(400).json({ error: "Batch code is required" });
    }

    const sql = `
        SELECT ut.id, ut.subject, bm.Batch_code
        FROM awt_unittesttaken AS ut
        LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = ut.batch_id
        WHERE bm.Batch_code = ?
    `;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            return res.json({ error: false, data });  // Return as an object for consistency
        }
    });
});


app.post("/nodeapp/getassignmentreport", (req, res) => {
    const { batch_code, assign_id } = req.body;

    const sql = `
        SELECT 
            (@rownum := @rownum + 1) AS \`index\`,
            sorted.assignmentname,
            sorted.subjects,
            sorted.Student_Name,
            sorted.Marks_Given,
            sorted.marks,
            sorted.Actual_Dt,
            sorted.Batch_code,
            sorted.Course_Name
        FROM (
            SELECT 
                ast.assignmentname,
                ast.subjects,
                ac.Student_Name,
                ac.Marks_Given,
                ast.marks,
                ac.Actual_Dt,
                bm.Batch_code,
                cm.Course_Name
            FROM Assignment_taken AS at
            LEFT JOIN assignmentstaken AS ast ON ast.id = at.Assignment_Id
            LEFT JOIN Assignment_given_child as ac ON ac.Given_Id = at.Given_Id
            LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = ast.batch_id
            LEFT JOIN Course_Mst as cm ON cm.Course_Id = bm.Course_Id
            WHERE at.IsDelete = 0
              AND bm.Batch_Code = ?
              AND ast.id = ?
            ORDER BY ac.Student_Name ASC
        ) AS sorted,
        (SELECT @rownum := 0) AS r
    `;

    con.query(sql, [batch_code, assign_id], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            return res.json(data);  // Index should now be 1, 2, 3 in correct order
        }
    });
});

app.post("/nodeapp/getstudentinterviewreport", (req, res) => {
    const { Batch_Id, Course_Id, Discipline, Qualification, Year } = req.body;

    if (!Batch_Id || !Course_Id) {
        return res.status(400).json({ error: "Batch_Id and Course_Id are required" });
    }

    let filters = `
        sm.IsDelete = 0
        AND sm.IsActive = 1
        AND sm.Status_id = 8
        AND sm.Course_Id = ?
        AND bm.Batch_Id = ?
    `;
    let params = [Course_Id, Batch_Id];

    if (Year) {
        filters += " AND sm.Year = ?";
        params.push(Year);
    }
    if (Qualification) {
        filters += " AND sm.Qualification = ?";
        params.push(Qualification);
    }
    if (Discipline) {
        filters += " AND sm.Discipline = ?";
        params.push(Discipline);
    }

    const sql = `
    WITH LatestCV AS (
    SELECT 
        cv.*,
        cs.CompanyName,
        cs.TDate,
        ROW_NUMBER() OVER (PARTITION BY cs.Batch_Id, cv.Student_Id ORDER BY cs.TDate DESC, cv.Cv_Id DESC) AS rn
    FROM 
        CV_Shortlisted cs
    INNER JOIN 
        CVChild cv ON cv.Cv_Id = cs.id
),
LatestResult AS (
    SELECT 
        gc.*,
        ROW_NUMBER() OVER (PARTITION BY gr.Batch_Id, gc.Student_Code ORDER BY gc.Gen_id DESC) AS rn
    FROM 
        generate_final_result gr
    LEFT JOIN 
        generate_final_child gc ON gc.Gen_id = gr.Id
)

SELECT DISTINCT 
    sm.Student_Name     AS Student_Name,
    bm.Batch_code       AS Batchcode, 
    DATE_FORMAT(bm.ConvocationDate, '%d-%m-%Y') AS ConvocationDate, 
    sm.Present_Mobile   AS ContactNo,
    sm.Email            AS Email,
    sm.Qualification    AS Qualification,
    sm.Year             AS Years,
    sm.Discipline       AS Discipline,
    sm.Marks            AS Marks,
    sm.Design_Exp       AS Design_Exp,
    sm.Total_Exp        AS Total_Exp,
    sm.Present_Address  AS cityState,
    lc.CompanyName      AS Company,
    lc.TDate            AS CVDate,
    lc.Placement        AS Placement,
    lc.Sended           AS cvsent,
    lc.PlacedBy         AS PlacedBy,
    lc.Remark           AS PLacedRemark,
    lc.Placement_Block  AS BlockPlacement,
    lc.Placement_BlockReason,
    lc.BlockReason_Remark,
    lr.Final_Result_Percent,
    lr.Full_Attendance,
    lr.Grade

FROM 
    Student_Master AS sm 
LEFT JOIN 
    Admission_master as am ON am.Student_Id = sm.Student_Id
LEFT JOIN 
    Batch_Mst as bm ON bm.Batch_Id = am.Batch_Id
LEFT JOIN 
    Status_Master AS stm ON stm.Id = sm.Status_id
LEFT JOIN 
    LatestCV AS lc 
        ON lc.Batch_Id = am.Batch_Id 
        AND lc.Student_Id = sm.Student_Id 
        AND lc.rn = 1
LEFT JOIN 
    generate_final_result gr ON gr.Batch_Id = bm.Batch_Id
LEFT JOIN 
    LatestResult AS lr 
        ON lr.Gen_id = gr.Id 
        AND lr.Student_Code = am.Student_Code
        AND lr.rn = 1

WHERE  ${filters} order by lr.Final_Result_Percent desc
    `;

    con.query(sql, params, (err, data) => {
        if (err) {
            console.error("SQL Error:", err);
            return res.json(err)
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getstudentlecturetakenreport", (req, res) => {
    const { batch_code, take_date } = req.body;

    if (!batch_code || !take_date) {
        return res.status(400).json({ error: true, message: "batch_code and take_date are required" });
    }

    const sql = `
        Select lt.Faculty_Id, lt.Lecture_Name, lt.Material, lt.Duration, lt.Topic, lt.Take_Dt, lt.Test_Given, cm.Course_Name, bm.Batch_code, fm.Faculty_Name FROM lecture_taken_master as lt LEFT JOIN Batch_Mst as bm ON bm.Batch_Id = lt.Batch_Id LEFT JOIN Course_Mst as cm ON cm.Course_Id = bm.Course_Id LEFT JOIN faculty_master as fm ON fm.Faculty_Id = lt.Faculty_Id WHERE bm.Batch_Code = ? AND lt.Take_Dt = ? ORDER BY lt.Lecture_Name ASC
    `;

    con.query(sql, [batch_code, take_date], (err, data) => {
        if (err) {
            return res.status(500).json({ error: true, message: err.message });
        }
        return res.json({ error: false, data });
    });
});


app.post("/nodeapp/getstudentyearly", (req, res) => {
    const { course, startdate, enddate } = req.body;

    let sql;
    let param = []

    sql = `
        SELECT 
    cm.Course_Name, 
    COUNT(DISTINCT sm.Student_Id) AS Student_Count
FROM 
    Admission_master AS am
LEFT JOIN 
    Student_Master AS sm ON sm.Student_Id = am.Student_Id
LEFT JOIN 
    Course_Mst AS cm ON cm.Course_Id = sm.Course_Id
WHERE 
    am.IsDelete = 0 
    AND am.IsActive = 1 
    AND sm.Status_id = 8 
    `;

    if (course) {
        sql += ` and sm.Course_Id = ? `
        param.push(course)
    }

    if (startdate && enddate) {
        sql += ` and am.Admission_Date >= ? and am.Admission_Date <= ? `
        param.push(startdate, enddate)
    }

    sql += ` GROUP BY 
    cm.Course_Name`

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.status(500).json({ error: true, message: err.message });
        }
        return res.json({ error: false, data, startdate: startdate, enddate: enddate });
    });
});


app.post("/nodeapp/getstandardlectureplanreport", (req, res) => {
    const { batch_code } = req.body;

    const sql = `
        SELECT lm.Lecture_Start, lm.Lecture_End, lm.Take_Dt, lm.Topic, sm.lecture_no, sm.starttime, sm.endtime, sm.lectureday, sm.planned, bm.Batch_code, bm.Category, sm.documents, fm.Faculty_Name, cm.Course_Name FROM lecture_taken_master AS lm LEFT JOIN Batch_SLecture_Master AS sm ON sm.id = lm.Lecture_Id LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = lm.Batch_Id LEFT JOIN faculty_master as fm on fm.Faculty_Id = lm.Faculty_Id LEFT JOIN Course_Mst as cm on cm.Course_Id = lm.Course_Id WHERE lm.IsDelete = 0 AND lm.IsActive = 1 AND bm.Batch_code = ? ORDER BY lm.Take_Id ASC`

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getforcardlist", (req, res) => {
    const { course_id, batch_code } = req.body;

    const sql = `
      SELECT 
    sm.Student_Id, 
    sm.Student_Name,
    cm.Course_Name,
    bm.Batch_code
FROM 
    Admission_master AS am
LEFT JOIN 
    Student_Master AS sm ON sm.Student_Id = am.Student_Id
LEFT JOIN 
    Course_Mst AS cm ON cm.Course_Id = sm.Course_Id
LEFT JOIN
    Batch_Mst as bm on bm.Batch_Id = am.Batch_Id
WHERE 
    am.IsDelete = 0 
    AND am.IsActive = 1 
    AND sm.Status_id = 8 
    and am.Course_Id = ? and bm.Batch_code = ? 
        `

    con.query(sql, [course_id, batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getcancelledstudent", (req, res) => {
    const { course, batch_code, startdate, enddate } = req.body;

    let param = [];
    let conditions = [];

    let sql = `
        SELECT 
            sm.Student_Name, 
            sm.Present_Mobile, 
            sm.Email, 
            bm.Batch_code, 
            DATE_FORMAT(bc.date, '%d-%m-%Y') AS cancel_date
        FROM 
            awt_batchcancellation AS bc
        LEFT JOIN 
            Batch_Mst AS bm ON bm.Batch_Id = bc.batchno
        LEFT JOIN 
            Course_Mst AS cm ON cm.Course_Id = bc.course
        LEFT JOIN 
            Student_Master AS sm ON sm.Student_Id = bc.student
    `;

    // Conditions
    if (course && batch_code) {
        conditions.push(`bc.course = ?`);
        param.push(course);

        conditions.push(`bm.Batch_code = ?`);
        param.push(batch_code);
    }

    if (startdate && enddate) {
        conditions.push(`bc.date >= ? AND bc.date <= ?`);
        param.push(startdate, enddate);
    }

    // If there are any conditions, add WHERE clause
    if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(' AND ');
    }

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.status(500).json({ error: true, message: err.message });
        } else {
            return res.json({ error: false, data, startdate, enddate });
        }
    });
});


app.post("/nodeapp/getmonthwise", (req, res) => {
    const { course, month, year } = req.body;

    let sql = `
        SELECT 
            cm.Course_Name, 
            COUNT(DISTINCT sm.Student_Id) AS Student_Count
        FROM 
            Admission_master AS am
        LEFT JOIN 
            Student_Master AS sm ON sm.Student_Id = am.Student_Id
        LEFT JOIN 
            Course_Mst AS cm ON cm.Course_Id = sm.Course_Id
        WHERE 
            am.IsDelete = 0 
            AND am.IsActive = 1 
            AND sm.Status_id = 8
    `;

    const params = [];

    if (course) {
        sql += ` AND sm.Course_Id = ?`;
        params.push(course);
    }

    const monthInt = parseInt(month, 10); // ensures "08" -> 8

    if (monthInt && year) {
        sql += ` AND MONTH(am.Admission_Date) = ? AND YEAR(am.Admission_Date) = ?`;
        params.push(monthInt, year);
    }

    sql += ` GROUP BY cm.Course_Name`;

    con.query(sql, params, (err, data) => {
        if (err) {
            return res.status(500).json({ error: true, message: err.message });
        }
        return res.json({ error: false, data, month: monthInt, year: year });
    });
});


app.post("/nodeapp/getannualbatchplanreport", (req, res) => {
    const { Course_Id, year, toyear } = req.body;

    if (!Course_Id || !year || !toyear) {
        return res.status(400).json({ error: "Course_Id_Id, year, toYear  are required." });
    }


    const sql = `
SELECT 
    cm.Course_Name,
    bm.Batch_code,
    bm.Batch_Id,
    bm.Category,
    bm.Timings,
    bm.SDate,
    bm.ActualDate,
    bm.Admission_Date,
    bm.EDate,
    bm.Duration,
    bm.Training_Coordinator
FROM 
    Batch_Mst AS bm
LEFT JOIN 
    Course_Mst AS cm ON cm.Course_Id = bm.Course_Id
WHERE 
    bm.IsDelete = 0 
    AND bm.Course_Id = ?
    AND YEAR(bm.SDate) BETWEEN ? AND ?

    `;

    con.query(sql, [Course_Id, year, toyear], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/getplacedstudent", (req, res) => {

    const { course, startdate, enddate } = req.body;

    let sql;
    let param = []

    sql = `
       SELECT cc.Student_Name ,sm.Discipline , bm.Batch_code ,csl.CompanyName ,csl.TDate , cc.Remark from CV_Shortlisted as csl LEFT JOIN CVChild as cc on cc.CV_Id = csl.id LEFT JOIN Student_Master as sm on sm.Student_Id = cc.Student_Id LEFT JOIN Batch_Mst as bm on bm.Batch_Id = cc.Batch_id WHERE cc.Placement_Block = 'Yes'
    `;

    if (course) {
        sql += ` and csl.Course_id = ? `
        param.push(course)
    }

    if (startdate && enddate) {
        sql += ` and csl.TDate >= ? and csl.TDate <= ? `
        param.push(startdate, enddate)
    }


    con.query(sql, param, (err, data) => {
        if (err) {
            return res.status(500).json({ error: true, message: err.message });
        }
        return res.json({ error: false, data, startdate: startdate, enddate: enddate });
    });
});


app.post("/nodeapp/getpaymentcollectionreport", (req, res) => {
    let { Course_Id, years, year } = req.body;

    if (!Course_Id || !years || !year) {
        return res.status(400).json({ error: "Course_Id, years, year are required." });
    }

    let sql = `
        SELECT 
            cm.Course_Id,
            cm.Course_Name,
            SUM(fm.Amount) AS Total_Amount,
            SUM(bm.Fees_Full_Payment) AS Total_Fees_Full_Payment,
            ROUND((SUM(fm.Amount) / SUM(bm.Fees_Full_Payment)) * 100, 2) AS Collection
        FROM 
            S_Fees_Mst AS fm
        LEFT JOIN 
            Batch_Mst AS bm ON bm.Batch_Id = fm.Batch_Id
        LEFT JOIN 
            Course_Mst AS cm ON cm.Course_Id = bm.Course_Id 
        WHERE 
            YEAR(bm.SDate) BETWEEN ? AND ?
    `;

    let params = [years, year];

    // Handle "All Courses" case
    if (Course_Id.includes(',')) {
        // Multiple Course Ids - build IN clause
        const courseIds = Course_Id.split(','); // ['1','2','3']
        const placeholders = courseIds.map(() => '?').join(','); // "?,?,?"
        sql += ` AND cm.Course_Id IN (${placeholders})`;
        params = params.concat(courseIds);
    } else {
        // Single Course Id
        sql += ' AND cm.Course_Id = ?';
        params.push(Course_Id);
    }

    sql += ' GROUP BY cm.Course_Id, cm.Course_Name';

    con.query(sql, params, (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/getbatchwisevivamoc", (req, res) => {
    const { batch_id } = req.body;

    const sql = "SELECT avt.vivamocname, bm.Batch_code FROM awt_vivamoctaken AS avt LEFT JOIN viva_taken AS vt ON vt.Viva_Id = avt.id LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = vt.Batch_Id WHERE bm.Batch_code = ? GROUP BY bm.Batch_code, avt.vivamocname";

    con.query(sql, [batch_id], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getyearlymockdata", (req, res) => {
    let { course_id, year, fromyear } = req.body;



    let sql = `SELECT
        vt.Take_Id, 
        cm.Course_Name, 
        bm.Batch_code, 
        MONTHNAME(vt.Take_Dt) AS month, 
        vt.Take_Dt 
    FROM 
        viva_taken AS vt 
    LEFT JOIN 
        Course_Mst AS cm ON cm.Course_Id = vt.Course_Id 
    LEFT JOIN 
        Batch_Mst AS bm ON bm.Batch_Id = vt.Batch_Id 
    WHERE 
        vt.IsDelete = 0 
        AND vt.Course_Id = ? 
        AND YEAR(vt.Take_Dt) BETWEEN ? AND ?`;


    con.query(sql, [course_id, year, fromyear], (err, data) => {
        if (err) {
            return res.json({ success: false, error: err });
        } else {
            return res.json({ success: true, data });
        }
    });
});

app.post("/nodeapp/getvivamocreport", (req, res) => {
    const { batch_code, vivamocname } = req.body;

    const sql = "SELECT * FROM ( SELECT cm.Course_Name, bm.Batch_code, vt.Take_Dt, vc.Marks_Given, sm.Student_Name, avt.vivamocname, avt.marks, am.Student_Code, ROW_NUMBER() OVER (PARTITION BY bm.Batch_code, sm.Student_Name, avt.vivamocname ORDER BY vt.Take_Dt) AS rn FROM viva_taken AS vt LEFT JOIN Course_Mst AS cm ON cm.Course_Id = vt.Course_Id LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = vt.Batch_Id LEFT JOIN viva_taken_child AS vc ON vc.Take_Id = vt.Take_Id LEFT JOIN Student_Master AS sm ON sm.Student_Id = vc.Student_Id LEFT JOIN Admission_master AS am ON am.Student_Id = sm.Student_Id LEFT JOIN awt_vivamoctaken AS avt ON avt.id = vt.Viva_Id WHERE vt.IsDelete = 0 AND bm.Batch_code = ? AND avt.vivamocname = ? ) AS filtered WHERE rn = 1";

    con.query(sql, [batch_code, vivamocname], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/getservicetaxcheque", (req, res) => {
    const { Cheque_No } = req.body;

    const sql = `SELECT
        fm.Fees_Code,
        sm.Student_Name,
        fm.RDate,
        fm.Payment_Type,
        fm.Amount,
        fm.Cheque_No,
        fm.Cheque_Date
    FROM 
        S_Fees_Mst AS fm 
    LEFT JOIN 
        Student_Master AS sm ON sm.Student_Id = fm.Student_Id
WHERE 
        fm.IsDelete = 0 
    AND fm.Cheque_No = ?`;

    con.query(sql, [Cheque_No], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/getbatchrecordpdf", (req, res) => {
    const { course, year, yearto } = req.body;

    let sql;
    let param;

    sql = `
        SELECT 
            bm.Batch_Id,
            bm.Batch_code,
            bm.Training_Coordinator,
            bm.Category,
            DATE_FORMAT(bm.SDate, '%d-%m-%Y') AS SDate,
            DATE_FORMAT(bm.EDate, '%d-%m-%Y') AS EDate,
            cm.Course_Id,
            cm.Course_Name,
            COUNT(DISTINCT am.Student_Id) AS Admission_Count,
            COUNT(DISTINCT abc.id) AS Cancellation_Count,
            COUNT(DISTINCT abt.id) AS Transfer_Count,
            COUNT(DISTINCT fem.Take_Id) AS exam_count
        FROM 
            Batch_Mst AS bm
        LEFT JOIN 
            awt_batchtransfer abt ON abt.oldbatch_code = bm.Batch_Id
        LEFT JOIN 
            Admission_master AS am ON am.Batch_Id = bm.Batch_Id
        LEFT JOIN 
            awt_batchcancellation AS abc ON abc.batchno = bm.Batch_Id
        LEFT JOIN 
            Course_Mst AS cm ON cm.Course_Id = bm.Course_Id    
        LEFT JOIN
            Final_exam_master as fem ON fem.Batch_Id = bm.Batch_Id 
        WHERE 
            bm.IsDelete = 0 
            AND am.IsDelete = 0 
            AND abc.deleted = 0 
            AND fem.IsDelete = 0 
            AND YEAR(bm.SDate) >= ? 
            AND YEAR(bm.SDate) <= ? 
    `;

    param = [year, yearto]

    if (course != 'All') {
        sql += ` AND bm.Course_Id = ?`
        param.push(course)
    }

    sql += `  GROUP BY 
            bm.Batch_Id, cm.Course_Id, cm.Course_Name`

    con.query(sql, param, (err, data) => {
        if (err) {
            return res.json({ success: false, error: err });
        } else {
            // Group batches by Course_Id
            const grouped = {};

            data.forEach(item => {
                if (!grouped[item.Course_Id]) {
                    grouped[item.Course_Id] = {
                        Course_Id: item.Course_Id,
                        Course_Name: item.Course_Name,
                        batches: []
                    };
                }

                grouped[item.Course_Id].batches.push({
                    Batch_Id: item.Batch_Id,
                    Batch_code: item.Batch_code,
                    Category: item.Category,
                    SDate: item.SDate,
                    EDate: item.EDate,
                    Training_Coordinator: item.Training_Coordinator,
                    Admission_Count: item.Admission_Count,
                    Cancellation_Count: item.Cancellation_Count,
                    Transfer_Count: item.Transfer_Count,
                    exam_count: item.exam_count
                });
            });

            const nestedData = Object.values(grouped);
            return res.json({ success: true, data: nestedData });
        }
    });
});




app.post("/nodeapp/getservicetaxreport", (req, res) => {
    const { fromdate, todate } = req.body;

    const sql = `SELECT
        fm.Fees_Code,
        sm.Student_Name,
        fm.RDate,
        fm.Payment_Type,
        fm.Amount,
        fm.Cheque_No,
        fm.Cheque_Date
    FROM 
        S_Fees_Mst AS fm 
    LEFT JOIN 
        Student_Master AS sm ON sm.Student_Id = fm.Student_Id
WHERE 
        fm.IsDelete = 0 
    AND fm.RDate BETWEEN ? AND ?`;

    con.query(sql, [fromdate, todate], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getfeesrecordpdf", (req, res) => {
    const { batch_code, course } = req.body;

    const sql = `SELECT 
    bm.Batch_code,
    bm.Fees_Full_Payment,
    cm.Course_Name,
    DATE_FORMAT(bm.SDate, '%d-%m-%Y') AS SDate,
    DATE_FORMAT(bm.EDate, '%d-%m-%Y') AS EDate
FROM 
    Batch_Mst AS bm
LEFT JOIN 
    Course_Mst AS cm ON cm.Course_Id = bm.Course_Id
WHERE 
    bm.Batch_code = ?
`;

    con.query(sql, [batch_code], (err, headerdata) => {
        if (err) {
            return res.json(err);
        } else {
            const sql2 = `
            SELECT  sfm.Fees_Code,
                sm.Student_Name,
                sm.Student_Id,
                am.Student_Code,
                sfm.RDate,
                sfm.Cheque_No,
                sfm.Payment_Type,
                sfm.Amount,
                sfm.TypeR
            FROM S_Fees_Mst AS sfm 
            LEFT JOIN Student_Master AS sm ON sm.Student_Id = sfm.Student_Id 
            LEFT JOIN Admission_master AS am ON am.Student_Id = sfm.Student_Id AND am.Batch_Id = sfm.Batch_Id 
            LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = sfm.Batch_Id 
            WHERE bm.Batch_code = ? AND sfm.Course_Id = ?`;

            con.query(sql2, [batch_code, course], (err, data) => {
                if (err) {
                    return res.json(err);
                } else {
                    // Group by Student_Id
                    const groupedData = {};

                    data.forEach(row => {
                        const studentId = row.Student_Id;
                        if (!groupedData[studentId]) {
                            groupedData[studentId] = {
                                Student_Name: row.Student_Name,
                                Student_Id: row.Student_Id,
                                Student_Code: row.Student_Code,
                                itsdata: []
                            };
                        }

                        groupedData[studentId].itsdata.push({
                            Fees_Code: row.Fees_Code,
                            Payment_Type: row.Payment_Type,
                            RDate: row.RDate,
                            Cheque_No: row.Cheque_No,
                            Amount: row.Amount,
                            TypeR: row.TypeR,
                        });
                    });

                    // Convert object to array
                    const nestedFeesData = Object.values(groupedData);

                    return res.json({
                        headerdata: headerdata,
                        feesdata: nestedFeesData
                    });
                }
            });
        }
    });
});

app.post("/nodeapp/getbatchwisefacultypayment", (req, res) => {
    const { batch_code } = req.body;

    const sql = `SELECT 
    fm.Faculty_Name,
    SUM(TIMESTAMPDIFF(
        MINUTE, 
        STR_TO_DATE(lt.Faculty_Start, '%h:%i%p'), 
        STR_TO_DATE(lt.Faculty_End, '%h:%i%p')
    )) / 60 AS Total_Hours, 
    fm.Salary, 
    (
        SUM(TIMESTAMPDIFF(
            MINUTE, 
            STR_TO_DATE(lt.Faculty_Start, '%h:%i%p'), 
            STR_TO_DATE(lt.Faculty_End, '%h:%i%p')
        )) / 60
    ) * fm.Salary AS Total_Amount,
    fm.Sal_Struct,
    bm.Batch_Code
FROM 
    lecture_taken_master AS lt
LEFT JOIN 
    faculty_master AS fm ON fm.Faculty_Id = lt.Faculty_Id
LEFT JOIN 
    Batch_Mst as bm ON bm.Batch_Id = lt.Batch_Id
WHERE 
    bm.Batch_Code = ?
GROUP BY 
    lt.Faculty_Id`;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/add_material_price", (req, res) => {

    let { item, vendor, price, created_by, uid } = req.body;

    const created_date = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format to 'YYYY-MM-DD HH:MM:SS'

    let sql;

    let param;
    if (uid == undefined) {
        sql = `insert into awt_material_price (Item,Vendor,Price,created_date,created_by) values(?,?,?,?,?)`;
        param = [item, vendor, price, created_date, created_by];
    } else {
        sql = `update awt_material_price set Item = ?, Vendor = ?,Price = ?, updated_by = ?, updated_date = ? where id =?`;
        param = [item, vendor, price, created_by, created_date, uid];
    }

    con.query(sql, param, (err, data) => {
        console.log(sql);
        if (err) {
            return res.json(err);
        } else {
            return res.json("Data Added Successfully!");
        }
    });
});

app.get("/nodeapp/getmaterialprice", (req, res) => {

    let sql;

    sql = `select amp.id , amp.Price , avm.vendorname as Vendor , amc.Category as Item   from awt_material_price as amp LEFT JOIN awt_vendor_master as avm on avm.id = amp.Vendor left JOIN awt_material_cat as amc on amc.id = amp.Item where amp.deleted = 0 and avm.deleted = 0 and amc.deleted = 0 order by amp.id DESC;`;

    con.query(sql, (err, data) => {

        if (err) {
            return res.json(err);
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getdocumentreport", (req, res) => {
    const { batch_code } = req.body;

    const sql = `
        SELECT 
    sm.Student_id,
    sm.Student_Name,
    bm.Batch_code,
    cm.Course_Name,
    MAX(CASE WHEN d.doc_name = 'photo' THEN 'YES' ELSE 'NO' END) AS photo,
    MAX(CASE WHEN d.doc_name = 'certificate' THEN 'YES' ELSE 'NO' END) AS certificate,
    MAX(CASE WHEN d.doc_name = 'marksheet' THEN 'YES' ELSE 'NO' END) AS marksheet,
    MAX(CASE WHEN d.doc_name = 'photo_id_proof' THEN 'YES' ELSE 'NO' END) AS photo_id_proof,
    MAX(CASE WHEN d.doc_name = 'address_proof' THEN 'YES' ELSE 'NO' END) AS address_proof
FROM 
    Student_Master AS sm
LEFT JOIN 
    Admission_master AS am ON am.Student_Id = sm.Student_Id
LEFT JOIN 
    Batch_Mst AS bm ON bm.Batch_Id = am.Batch_Id
LEFT JOIN 
    Course_Mst AS cm ON cm.Course_Id = sm.Course_Id
LEFT JOIN 
    Documents AS d ON d.Student_Id = sm.Student_Id
WHERE 
    bm.Batch_code = ?
    AND sm.IsDelete = 0
GROUP BY 
    sm.Student_id,
    sm.Student_Name,
    bm.Batch_code,
    cm.Course_Name
ORDER BY 
    sm.Student_Name ASC;
    `;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            return res.json(data);
        }
    });
});


app.post("/nodeapp/getStudentListReport", (req, res) => {
    const { batch_code } = req.body;

    const sql = `SELECT sm.Student_Id,
            sm.Student_Name,
            sm.Present_Mobile,
            si.Qualification,
            am.Admission_Date,
            am.Student_Code,
            sm.Present_Address,
            sm.Present_Tel,
            bm.Batch_code,
            bm.EDate as Valid_Date,
            afc.Grade,
            cm.Course_Name
        FROM Student_Master AS sm
        LEFT JOIN Admission_master AS am ON am.Student_Id = sm.Student_Id
        LEFT JOIN Batch_Mst AS bm ON bm.Batch_Id = am.Batch_Id
        LEFT JOIN Course_Mst AS cm ON cm.Course_Id = am.Course_Id
        LEFT JOIN generate_final_child as afc on afc.Student_Code = am.Student_Code
        LEFT JOIN Student_Inquiry as si on si.Student_Id = sm.Student_Id
        WHERE sm.IsDelete = 0 
            AND am.IsDelete = 0 
            AND am.IsActive = 1 
            AND sm.Status_id = 8 
            AND bm.Batch_Code = ? group by sm.Student_Id
        ORDER BY sm.Student_Name ASC`;

    con.query(sql, [batch_code], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            return res.json(data);
        }
    });
});


app.get("/nodeapp/get_batchconvocation/:batchid", (req, res) => {
    const { batchid } = req.params;

    const sql = `SELECT * FROM Convocation_Guest_List where Batch_Id = ? and IsActive = 1 and IsDelete = 0`;

    con.query(sql, [batchid], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            return res.json(data);
        }
    });
});

app.post("/nodeapp/getfullagttendencereport", (req, res) => {
    const { batchId } = req.body; // since you are posting, better to use req.body instead of req.params

    const sql = `
        SELECT 
            ltm.Take_Id,
            CONCAT(DATE_FORMAT(ltm.Take_Dt , '%d-%m-%Y'), ' ', ltm.Lecture_Start, ' - ', ltm.Lecture_Start) AS Take_dt,
            ltc.Student_Name,
            CASE 
                WHEN ltc.Student_Atten = 'Present' THEN 'P'
                WHEN ltc.Student_Atten = 'Absent' THEN 'A'
                ELSE ltc.Student_Atten
            END AS Student_Atten
        FROM lecture_taken_master AS ltm
        LEFT JOIN Lecture_taken_child AS ltc 
            ON ltc.Take_Id = ltm.Take_Id 
        WHERE ltm.IsDelete = 0 and ltc.IsDelete = 0
          AND ltm.Batch_Id = ? order by ltm.Take_Dt desc`;


    con.query(sql, [batchId], (err, data) => {
        if (err) {
            return res.json({ error: true, message: err });
        } else {
            // Transform flat data into grouped format
            const grouped = {};

            data.forEach(row => {
                if (!grouped[row.Take_Id]) {
                    grouped[row.Take_Id] = {
                        take_id: row.Take_Id,
                        take_dt: row.Take_dt,
                        attendance: {}
                    };
                }

                grouped[row.Take_Id].attendance[row.Student_Name] = row.Student_Atten;
            });

            // Convert object into array
            const result = Object.values(grouped);

            return res.json(result);
        }
    });
});
