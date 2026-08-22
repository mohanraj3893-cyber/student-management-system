const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, './sms_database.sqlite');

console.log('Migrating SQLite columns at:', dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  // Alter faculty table
  db.run(`ALTER TABLE faculty ADD COLUMN qualification VARCHAR(255)`, (err) => {
    if (err) console.log('qualification column may already exist or error:', err.message);
    else console.log('Added qualification column to faculty');
  });

  db.run(`ALTER TABLE faculty ADD COLUMN research_area VARCHAR(255)`, (err) => {
    if (err) console.log('research_area column may already exist or error:', err.message);
    else console.log('Added research_area column to faculty');
  });

  db.run(`ALTER TABLE faculty ADD COLUMN publications TEXT`, (err) => {
    if (err) console.log('publications column may already exist or error:', err.message);
    else console.log('Added publications column to faculty');
  });

  // Alter students table
  db.run(`ALTER TABLE students ADD COLUMN guardian_name VARCHAR(255)`, (err) => {
    if (err) console.log('guardian_name column may already exist or error:', err.message);
    else console.log('Added guardian_name column to students');
  });

  // Alter attendance_sessions table
  db.run(`ALTER TABLE attendance_sessions ADD COLUMN department VARCHAR(100) DEFAULT 'Computer Science & Engineering'`, (err) => {
    if (err) console.log('department column may already exist or error:', err.message);
    else console.log('Added department column to attendance_sessions');
  });

  db.run(`ALTER TABLE attendance_sessions ADD COLUMN year VARCHAR(50) DEFAULT '3'`, (err) => {
    if (err) console.log('year column may already exist or error:', err.message);
    else console.log('Added year column to attendance_sessions');
  });

  db.run(`ALTER TABLE attendance_sessions ADD COLUMN semester VARCHAR(50) DEFAULT '5'`, (err) => {
    if (err) console.log('semester column may already exist or error:', err.message);
    else console.log('Added semester column to attendance_sessions');
  });

  db.run(`ALTER TABLE attendance_sessions ADD COLUMN section VARCHAR(50) DEFAULT 'A'`, (err) => {
    if (err) console.log('section column may already exist or error:', err.message);
    else console.log('Added section column to attendance_sessions');
  });

  db.run(`ALTER TABLE attendance_sessions ADD COLUMN date DATE`, (err) => {
    if (err) console.log('date column may already exist or error:', err.message);
    else console.log('Added date column to attendance_sessions');
  });

  // Alter attendance_records table
  db.run(`ALTER TABLE attendance_records ADD COLUMN date DATE`, (err) => {
    if (err) console.log('date column may already exist or error:', err.message);
    else console.log('Added date column to attendance_records');
  });

  db.run(`ALTER TABLE attendance_records ADD COLUMN marked_at DATETIME`, (err) => {
    if (err) console.log('marked_at column may already exist or error:', err.message);
    else console.log('Added marked_at column to attendance_records');
  });

  // Alter leave_requests table
  db.run(`ALTER TABLE leave_requests ADD COLUMN leave_type VARCHAR(100)`, (err) => {
    if (err) console.log('leave_type column may already exist or error:', err.message);
    else console.log('Added leave_type column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN from_date DATE`, (err) => {
    if (err) console.log('from_date column may already exist or error:', err.message);
    else console.log('Added from_date column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN to_date DATE`, (err) => {
    if (err) console.log('to_date column may already exist or error:', err.message);
    else console.log('Added to_date column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN number_of_days INTEGER`, (err) => {
    if (err) console.log('number_of_days column may already exist or error:', err.message);
    else console.log('Added number_of_days column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN supporting_document VARCHAR(255)`, (err) => {
    if (err) console.log('supporting_document column may already exist or error:', err.message);
    else console.log('Added supporting_document column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN hod_remarks TEXT`, (err) => {
    if (err) console.log('hod_remarks column may already exist or error:', err.message);
    else console.log('Added hod_remarks column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN rejection_reason TEXT`, (err) => {
    if (err) console.log('rejection_reason column may already exist or error:', err.message);
    else console.log('Added rejection_reason column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN processed_by INTEGER`, (err) => {
    if (err) console.log('processed_by column may already exist or error:', err.message);
    else console.log('Added processed_by column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN processed_at DATETIME`, (err) => {
    if (err) console.log('processed_at column may already exist or error:', err.message);
    else console.log('Added processed_at column to leave_requests');
  });

  db.run(`ALTER TABLE leave_requests ADD COLUMN submitted_at DATETIME`, (err) => {
    if (err) console.log('submitted_at column may already exist or error:', err.message);
    else console.log('Added submitted_at column to leave_requests');
  });
});

db.close(() => {
  console.log('Migration finished.');
});
