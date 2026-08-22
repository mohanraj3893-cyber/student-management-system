const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'sms_database.sqlite');

console.log('Fixing SQLite table constraints at:', dbPath);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Fix leave_requests table
  db.run(`CREATE TABLE IF NOT EXISTS leave_requests_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    leave_type VARCHAR(100) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    start_date DATE,
    end_date DATE,
    number_of_days INTEGER NOT NULL,
    reason TEXT NOT NULL,
    supporting_document VARCHAR(255),
    status VARCHAR(30) DEFAULT 'Pending',
    hod_remarks TEXT,
    rejection_reason TEXT,
    processed_by INTEGER,
    processed_at DATETIME,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  // Copy existing leave requests if any
  db.run(`INSERT INTO leave_requests_new (id, student_id, leave_type, from_date, to_date, start_date, end_date, number_of_days, reason, supporting_document, status, hod_remarks, rejection_reason, processed_by, processed_at, submitted_at, created_at, updated_at)
    SELECT id, student_id, 
      COALESCE(leave_type, 'Leave'), 
      COALESCE(from_date, start_date, '2026-08-01'), 
      COALESCE(to_date, end_date, '2026-08-01'),
      COALESCE(start_date, from_date, '2026-08-01'),
      COALESCE(end_date, to_date, '2026-08-01'),
      COALESCE(number_of_days, 1),
      COALESCE(reason, 'Leave application'),
      supporting_document,
      COALESCE(status, 'Pending'),
      hod_remarks,
      rejection_reason,
      processed_by,
      processed_at,
      submitted_at,
      created_at,
      updated_at
    FROM leave_requests;`, (err) => {
      if (err) console.log('Copy leave_requests info:', err.message);
      else console.log('Successfully copied leave_requests data.');
  });

  db.run(`DROP TABLE leave_requests;`);
  db.run(`ALTER TABLE leave_requests_new RENAME TO leave_requests;`);

  // 2. Fix attendance_sessions table
  db.run(`CREATE TABLE IF NOT EXISTS attendance_sessions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id INTEGER NOT NULL,
    department VARCHAR(100) DEFAULT 'Computer Science & Engineering',
    year VARCHAR(50) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    section VARCHAR(50) DEFAULT 'A',
    date DATE NOT NULL,
    period INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  db.run(`INSERT INTO attendance_sessions_new (id, faculty_id, department, year, semester, section, date, period, created_at, updated_at)
    SELECT id, faculty_id, 
      COALESCE(department, 'Computer Science & Engineering'),
      COALESCE(year, '3'),
      COALESCE(semester, '5'),
      COALESCE(section, 'A'),
      COALESCE(date, '2026-08-15'),
      period,
      created_at,
      updated_at
    FROM attendance_sessions;`, (err) => {
      if (err) console.log('Copy attendance_sessions info:', err.message);
      else console.log('Successfully copied attendance_sessions data.');
  });

  db.run(`DROP TABLE attendance_sessions;`);
  db.run(`ALTER TABLE attendance_sessions_new RENAME TO attendance_sessions;`);

  console.log('Database constraint cleanup completed.');
});
