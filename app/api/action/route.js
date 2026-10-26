import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

let cacheStore = {
  examPack: {},
  lastFetchTime: 0
};
const CACHE_TTL = 5 * 60 * 1000;

export async function POST(req) {
  try {
    const { action, args } = await req.json();

    if (action === 'getLandingData') {
      try {
        const settings = await turso.execute("SELECT * FROM Settings WHERE KeyName IN ('SesiAktif', 'JamSesi1', 'JamSesi2', 'JamSesi3')");
        let data = { SesiAktif: '1', JamSesi1: '07.30 - 09.00', JamSesi2: '09.30 - 11.00', JamSesi3: '11.30 - 13.00' };
        settings.rows.forEach(r => { data[r.KeyName] = r.KeyValue; });
        return NextResponse.json({ status: 'success', data: data });
      } catch (e) {
        return NextResponse.json({ status: 'success', data: { SesiAktif: '1', JamSesi1: '07.30 - 09.00', JamSesi2: '09.30 - 11.00', JamSesi3: '11.30 - 13.00' } });
      }
    }

    if (action === 'adminUpdateSesiGlobal') {
      const newSesi = args[0];
      try {
        await turso.execute("CREATE TABLE IF NOT EXISTS Settings (KeyName VARCHAR(50) PRIMARY KEY, KeyValue VARCHAR(255))");
        await turso.execute({ sql: "INSERT OR REPLACE INTO Settings (KeyName, KeyValue) VALUES ('SesiAktif', ?)", args: [newSesi] });
        return NextResponse.json({ status: 'success', msg: 'Sesi Aktif Berhasil Diperbarui' });
      } catch (e) {
        return NextResponse.json({ status: 'error', msg: e.message });
      }
    }

    if (action === 'adminUpdateJamSesi') {
      const { s1, s2, s3 } = args[0];
      try {
        await turso.execute("CREATE TABLE IF NOT EXISTS Settings (KeyName VARCHAR(50) PRIMARY KEY, KeyValue VARCHAR(255))");
        await turso.execute({ sql: "INSERT OR REPLACE INTO Settings (KeyName, KeyValue) VALUES ('JamSesi1', ?)", args: [s1] });
        await turso.execute({ sql: "INSERT OR REPLACE INTO Settings (KeyName, KeyValue) VALUES ('JamSesi2', ?)", args: [s2] });
        await turso.execute({ sql: "INSERT OR REPLACE INTO Settings (KeyName, KeyValue) VALUES ('JamSesi3', ?)", args: [s3] });
        return NextResponse.json({ status: 'success', msg: 'Jam Sesi Berhasil Diperbarui' });
      } catch (e) {
        return NextResponse.json({ status: 'error', msg: e.message });
      }
    }

    if (action === 'getDashboardData') {
      const [role, userId, , sekolah] = args; 
      let exams, users;
      
      if (role === 'guru') {
        exams = await turso.execute("SELECT * FROM Exams WHERE Mapel != 'SURVEY'");
        users = await turso.execute({ sql: "SELECT * FROM Users WHERE Role = 'siswa' AND LOWER(TRIM(Sekolah)) = LOWER(TRIM(?))", args: [sekolah] });
      } else {
        exams = await turso.execute("SELECT * FROM Exams WHERE Mapel != 'SURVEY'");
        users = await turso.execute("SELECT * FROM Users WHERE Role = 'siswa'");
      }
      
      let output = { logo: 'https://lh3.googleusercontent.com/d/1SCvmdQxuqmX_f0gBaYt0Ob53Tws97Hnq' };
      
      // Ambil Sesi Global dan Jam Sesi
      try {
        const settings = await turso.execute("SELECT * FROM Settings WHERE KeyName IN ('SesiAktif', 'JamSesi1', 'JamSesi2', 'JamSesi3')");
        output.sesiAktif = '1'; output.jamSesi1 = '07.30 - 09.00'; output.jamSesi2 = '09.30 - 11.00'; output.jamSesi3 = '11.30 - 13.00';
        settings.rows.forEach(r => {
            if(r.KeyName === 'SesiAktif') output.sesiAktif = r.KeyValue;
            if(r.KeyName === 'JamSesi1') output.jamSesi1 = r.KeyValue;
            if(r.KeyName === 'JamSesi2') output.jamSesi2 = r.KeyValue;
            if(r.KeyName === 'JamSesi3') output.jamSesi3 = r.KeyValue;
        });
      } catch(e) {}
      
      if (role === 'admin' || role === 'guru') {
        output.exams = exams.rows;
        output.stats = { 
            totalSiswa: users.rows.length, 
            totalUjian: exams.rows.length, 
            activeUjian: exams.rows.filter(e => e.Status === 'Aktif').length 
        };

        // TAMBAHAN: Menghitung jumlah peserta per sekolah
        let schoolCounts = {};
        users.rows.forEach(u => {
            let s = (u.Sekolah || 'Tanpa Sekolah').trim();
            schoolCounts[s] = (schoolCounts[s] || 0) + 1;
        });
        output.schoolSummary = Object.keys(schoolCounts).map(k => ({
            Sekolah: k,
            Jumlah: schoolCounts[k]
        })).sort((a, b) => b.Jumlah - a.Jumlah); // Urutkan dari siswa terbanyak

        const schoolRankQuery = await turso.execute(`
            SELECT u.Sekolah, AVG(r.TotalNilai) as RataRata 
            FROM Results r 
            JOIN Users u ON r.SiswaID = u.ID 
            JOIN Exams e ON r.ExamID = e.ExamID
            WHERE e.Mapel != 'SURVEY' ${role === 'guru' ? "AND e.ShowStats IN ('Yes', 'Aktif')" : ""}
            GROUP BY u.Sekolah 
            ORDER BY RataRata DESC
        `);
        output.schoolRanks = schoolRankQuery.rows;

        if (role === 'guru') {
            const studentRankQuery = await turso.execute({
                sql: `SELECT u.Nama, u.Kelas, e.Mapel, AVG(r.TotalNilai) as RataRata 
                      FROM Results r 
                      JOIN Users u ON r.SiswaID = u.ID 
                      JOIN Exams e ON r.ExamID = e.ExamID 
                      WHERE LOWER(TRIM(u.Sekolah)) = LOWER(TRIM(?)) AND e.Mapel != 'SURVEY' AND e.ShowStats IN ('Yes', 'Aktif')
                      GROUP BY u.ID, e.Mapel 
                      ORDER BY e.Mapel ASC, RataRata DESC`,
                args: [sekolah]
            });
            output.studentRanks = studentRankQuery.rows;
        }
        
        if (role === 'admin') {
            const surveys = await turso.execute("SELECT * FROM Exams WHERE Mapel = 'SURVEY'");
            output.surveys = surveys.rows;
        }

      } else if (role === 'siswa') {
        output.availableExams = exams.rows.filter(e => e.Status === 'Aktif');
        const history = await turso.execute({ 
          sql: "SELECT r.ResultID, r.ExamID, r.WaktuSubmit, r.TotalNilai as Nilai, e.Judul, e.AllowDownloadR, e.AllowDownloadQ, e.ShowStats, r.Pelanggaran FROM Results r JOIN Exams e ON r.ExamID = e.ExamID WHERE r.SiswaID = ? AND e.Mapel != 'SURVEY'", 
          args: [userId] 
        });
        output.history = history.rows;
        
        const userSelf = await turso.execute({ sql: "SELECT Sesi FROM Users WHERE ID = ?", args: [userId] });
        if(userSelf.rows.length > 0) output.userSesi = userSelf.rows[0].Sesi;
      }
      return NextResponse.json({ status: 'success', data: output });
    }

    if (action === 'getAdminData') {
      const [role, , , sekolah] = args;
      let exams, users;
      if (role === 'guru') {
        exams = await turso.execute("SELECT * FROM Exams");
        users = await turso.execute({ sql: "SELECT * FROM Users WHERE Role = 'siswa' AND LOWER(TRIM(Sekolah)) = LOWER(TRIM(?))", args: [sekolah] });
      } else {
        exams = await turso.execute("SELECT * FROM Exams");
        users = await turso.execute("SELECT * FROM Users WHERE Role = 'siswa'");
      }
      return NextResponse.json({ status: 'success', exams: exams.rows, users: users.rows, logo: 'https://lh3.googleusercontent.com/d/1SCvmdQxuqmX_f0gBaYt0Ob53Tws97Hnq' });
    }

    if (action === 'getUserList') {
      const [role, , sekolah] = args;
      let users;
      if (role === 'guru') users = await turso.execute({ sql: "SELECT * FROM Users WHERE Role = 'siswa' AND LOWER(TRIM(Sekolah)) = LOWER(TRIM(?))", args: [sekolah] });
      else users = await turso.execute("SELECT * FROM Users"); 
      return NextResponse.json({ status: 'success', data: users.rows });
    }

    if (action === 'adminManageUser') {
      const mode = args[0]; const d = args[1];
      if (mode === 'save') {
        const id = d.id || ('U' + Date.now());
        const cek = await turso.execute({ sql: "SELECT ID FROM Users WHERE ID = ?", args: [id] });
        if (cek.rows.length > 0) {
          await turso.execute({ sql: "UPDATE Users SET Nama=?, Username=?, Password=?, Role=?, Sekolah=?, Kelas=?, TglLahir=?, Foto=?, Sesi=? WHERE ID=?", args: [d.nama, d.username, d.password, d.role, d.sekolah, d.kelas, d.tglLahir, d.foto, d.sesi, id] });
        } else {
          await turso.execute({ sql: "INSERT INTO Users (ID, Nama, Username, Password, Role, Sekolah, Kelas, TglLahir, Foto, Sesi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, d.nama, d.username, d.password, d.role, d.sekolah, d.kelas, d.tglLahir, d.foto, d.sesi] });
        }
      } else if (mode === 'delete') {
        await turso.execute({ sql: "DELETE FROM Users WHERE ID = ?", args: [d.id] });
      }
      return NextResponse.json({ status: 'success', msg: 'Data User berhasil disimpan!' });
    }

    if (action === 'adminSaveExam') {
      const d = args[0]; const id = d.examId || ('EX' + Date.now());
      const cek = await turso.execute({ sql: "SELECT ExamID FROM Exams WHERE ExamID = ?", args: [id] });
      if (cek.rows.length > 0) {
        await turso.execute({ sql: "UPDATE Exams SET Judul=?, Mapel=?, TargetKelas=?, Durasi=?, Token=?, StartDate=?, EndDate=?, LimitTries=?, ShowStats=?, RandomQ=?, AllowDownloadQ=?, AllowDownloadR=? WHERE ExamID=?", args: [d.judul, d.mapel, d.targetKelas, d.durasi, d.token || '', d.start, d.end, d.limit || 1, d.showStats, d.randomQ, d.dlSoal, d.dlHasil, id] });
      } else {
        await turso.execute({ sql: "INSERT INTO Exams (ExamID, Judul, Mapel, TargetKelas, Durasi, Token, StartDate, EndDate, LimitTries, ShowStats, RandomQ, AllowDownloadQ, AllowDownloadR, PembuatID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, d.judul, d.mapel, d.targetKelas, d.durasi, d.token || '', d.start, d.end, d.limit || 1, d.showStats, d.randomQ, d.dlSoal, d.dlHasil, d.userId] });
      }
      return NextResponse.json({ status: 'success', msg: 'Jadwal Ujian berhasil dibuat!' });
    }

    if (action === 'adminDeleteExam') {
      await turso.execute({ sql: "DELETE FROM Exams WHERE ExamID = ?", args: [args[0]] });
      return NextResponse.json({ status: 'success', msg: 'Jadwal/Survey dihapus!' });
    }

    if (action === 'getExamQuestions' || action === 'getSiswaSoal') {
      const qs = await turso.execute({ sql: "SELECT * FROM Questions WHERE ExamID = ?", args: [args[0]] });
      if (action === 'getSiswaSoal') return NextResponse.json({ status: 'success', data: qs.rows });
      return NextResponse.json(qs.rows);
    }

    if (action === 'adminSaveSingleQuestion') {
      const eid = args[0]; const d = args[1]; const userId = args[2]; const id = d.id || ('Q' + Date.now());
      const cek = await turso.execute({ sql: "SELECT QID FROM Questions WHERE QID = ?", args: [id] });
      if (cek.rows.length > 0) {
        await turso.execute({ sql: "UPDATE Questions SET Tipe=?, Pertanyaan=?, Options=?, Key=?, Skor=?, Nomor=? WHERE QID=?", args: [d.type, d.text, JSON.stringify(d.options), JSON.stringify(d.key), d.score, d.num, id] });
      } else {
        await turso.execute({ sql: "INSERT INTO Questions (QID, ExamID, Tipe, Pertanyaan, Options, Key, Skor, Nomor, PembuatID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, eid, d.type, d.text, JSON.stringify(d.options), JSON.stringify(d.key), d.score, d.num, userId] });
      }
      return NextResponse.json({ status: 'success', id: id, msg: 'Soal/Pernyataan tersimpan!' });
    }

    if (action === 'adminDeleteQuestion') {
      await turso.execute({ sql: "DELETE FROM Questions WHERE QID = ?", args: [args[0]] });
      return NextResponse.json({ status: 'success', msg: 'Soal dihapus!' });
    }

    if (action === 'adminBatchSaveQuestions') {
      const eid = args[0]; const qArr = args[1]; const userId = args[2];
      for(let q of qArr) {
         const id = 'Q' + Date.now() + Math.floor(Math.random()*1000);
         await turso.execute({ sql: "INSERT INTO Questions (QID, ExamID, Tipe, Pertanyaan, Options, Key, Skor, Nomor, PembuatID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, eid, q.type, q.text, JSON.stringify(q.options), JSON.stringify(q.key), q.score, q.num, userId] });
      }
      return NextResponse.json({ status: 'success', msg: `${qArr.length} soal diupload!` });
    }

    if (action === 'adminSaveSurvey') {
      const d = args[0]; const id = d.id || ('SRV' + Date.now());
      const cek = await turso.execute({ sql: "SELECT ExamID FROM Exams WHERE ExamID = ?", args: [id] });
      if (cek.rows.length > 0) {
          await turso.execute({ sql: "UPDATE Exams SET Judul=?, TargetKelas=?, ShowStats=?, Token=? WHERE ExamID=?", args: [d.judul, d.desc, d.status, d.linkedExam, id] });
      } else {
          await turso.execute({ sql: "INSERT INTO Exams (ExamID, Judul, Mapel, TargetKelas, Durasi, Token, StartDate, EndDate, LimitTries, ShowStats, RandomQ, AllowDownloadQ, AllowDownloadR, PembuatID) VALUES (?, ?, 'SURVEY', ?, 0, ?, '', '', 1, ?, 'No', 'No', 'No', ?)", args: [id, d.judul, d.desc, d.linkedExam, d.status, d.userId] });
      }
      return NextResponse.json({ status: 'success', msg: 'Survey ditautkan & disimpan!' });
    }

    if (action === 'checkActiveSurvey') {
        const finishedExamId = args[0]; 
        const srv = await turso.execute({
            sql: "SELECT * FROM Exams WHERE Mapel='SURVEY' AND Token=? AND ShowStats='Aktif' LIMIT 1",
            args: [finishedExamId]
        });
        if(srv.rows.length > 0) {
            const qs = await turso.execute({ sql: "SELECT * FROM Questions WHERE ExamID = ?", args: [srv.rows[0].ExamID] });
            return NextResponse.json({ status: 'success', data: { header: srv.rows[0], qs: qs.rows } });
        }
        return NextResponse.json({ status: 'empty' });
    }

    if (action === 'submitSurveyResponse') {
        const uid = args[0]; const sid = args[1]; const answers = args[2]; const waktuSubmit = args[3];
        await turso.execute({ 
           sql: "INSERT INTO Results (ResultID, SiswaID, ExamID, TotalNilai, Detail, Pelanggaran, WaktuSubmit) VALUES (?, ?, ?, 0, ?, 'Survey Response', ?)", 
           args: ['SRES' + Date.now(), uid, sid, JSON.stringify(answers), waktuSubmit] 
        });
        try { await turso.execute({ sql: "UPDATE Users SET Status='Survei Selesai', Terjawab=TotalSoal WHERE ID=?", args: [uid] }); } catch(e){}
        return NextResponse.json({ status: 'success', msg: 'Survey dikirim' });
    }

    if (action === 'getExamPack') {
      const eid = args[0]; const uid = args[1];
      const history = await turso.execute({ sql: "SELECT * FROM Results WHERE ExamID=? AND SiswaID=?", args: [eid, uid]});
      if(history.rows.length > 0) return NextResponse.json({status: 'error', msg: 'Ujian sudah dikerjakan.'});
      
      const now = Date.now();
      if (!cacheStore.examPack[eid] || (now - cacheStore.lastFetchTime > CACHE_TTL)) {
          const examInfo = await turso.execute({ sql: "SELECT * FROM Exams WHERE ExamID=?", args:[eid] });
          const qs = await turso.execute({ sql: "SELECT * FROM Questions WHERE ExamID=?", args:[eid] });
          const cleanQ = qs.rows.map(q => ({ QID: q.QID, Tipe: q.Tipe, Pertanyaan: q.Pertanyaan, Options: q.Options, Nomor: q.Nomor, Extra: [] }));
          cacheStore.examPack[eid] = {
              data: cleanQ, 
              duration: examInfo.rows[0].Durasi, 
              judul: examInfo.rows[0].Judul, 
              token: examInfo.rows[0].Token
          };
          cacheStore.lastFetchTime = now;
      }

      const cachedExam = cacheStore.examPack[eid];
      return NextResponse.json({ 
          status: 'success', 
          data: cachedExam.data, 
          duration: cachedExam.duration, 
          judul: cachedExam.judul, 
          token: cachedExam.token 
      });
    }

    if (action === 'submitExam') {
       const uid = args[0]; const eid = args[1]; const answers = args[2]; const violations = args[3]; const waktuSubmit = args[4];
       
       let rawTotalScore = 0; 
       let detailLog = [];
       let maxPossibleTotalScore = 0;

       const qs = await turso.execute({ sql: "SELECT * FROM Questions WHERE ExamID=?", args:[eid] });
       qs.rows.forEach(q => { maxPossibleTotalScore += Number(q.Skor) || 0; });

       answers.forEach(ans => {
          const q = qs.rows.find(x => x.QID === ans.qid);
          if(q) {
             const keys = JSON.parse(q.Key || "[]");
             let scoreEarned = 0;
             const maxSkor = Number(q.Skor) || 0;

             if (q.Tipe === 'PGK') {
                 if (Array.isArray(ans.answer)) {
                     const correct_selected = ans.answer.filter(val => keys.includes(val)).length;
                     const wrong_selected = ans.answer.filter(val => !keys.includes(val)).length;
                     const total_correct_keys = keys.length;
                     if (total_correct_keys > 0) {
                         let partial = (correct_selected - wrong_selected) / total_correct_keys;
                         if (partial < 0) partial = 0; 
                         scoreEarned = partial * maxSkor;
                     }
                 }
             } else if (q.Tipe === 'PGKK') {
                 if (Array.isArray(ans.answer)) {
                     let correct_match = 0;
                     const total_statements = keys.length;
                     ans.answer.forEach((val, idx) => {
                         if (val && val === keys[idx]) correct_match++;
                     });
                     if (total_statements > 0) scoreEarned = (correct_match / total_statements) * maxSkor;
                 }
             } else if (q.Tipe === 'PGS') {
                 if (keys.includes(ans.answer)) scoreEarned = maxSkor;
             } else {
                 if (Array.isArray(ans.answer)) {
                     if (JSON.stringify(ans.answer) === JSON.stringify(keys)) scoreEarned = maxSkor;
                 } else {
                     if (keys.includes(ans.answer)) scoreEarned = maxSkor;
                 }
             }
             
             scoreEarned = Math.round(scoreEarned * 100) / 100;
             rawTotalScore += scoreEarned;
             detailLog.push({ i: q.Nomor, s: scoreEarned, m: maxSkor, t: q.Tipe, a: ans.answer });
          }
       });

       let finalScore100 = maxPossibleTotalScore > 0 ? (rawTotalScore / maxPossibleTotalScore) * 100 : 0;
       finalScore100 = Math.round(finalScore100 * 100) / 100;

       await turso.execute({ 
           sql: "INSERT INTO Results (ResultID, SiswaID, ExamID, TotalNilai, Detail, Pelanggaran, WaktuSubmit) VALUES (?, ?, ?, ?, ?, ?, ?)", 
           args: ['RES' + Date.now(), uid, eid, finalScore100, JSON.stringify(detailLog), violations > 0 ? `Pelanggaran: ${violations}x` : "-", waktuSubmit] 
       });
       
       try { await turso.execute({ sql: "UPDATE Users SET Status='Selesai Ujian TKA', Terjawab=0 WHERE ID=?", args: [uid] }); } catch(e){}

       return NextResponse.json({ status: 'success', msg: 'Berhasil dikirim', data: { score: finalScore100 } });
    }

    if (action === 'getRecapList') {
      const [role, , sekolah] = args;
      let sql = `
        SELECT r.ResultID, r.TotalNilai, r.WaktuSubmit, r.Detail, r.SiswaID, r.ExamID, r.Pelanggaran,
               u.Nama AS NamaSiswa, u.Kelas AS KelasSiswa, u.Sekolah AS SekolahSiswa,
               e.Judul AS JudulUjian, e.Mapel AS Mapel, e.PembuatID AS PembuatID,
               e.ShowStats AS ShowStats,
               (SELECT Nama FROM Users WHERE ID = e.PembuatID) AS PembuatNama
        FROM Results r
        LEFT JOIN Users u ON r.SiswaID = u.ID
        LEFT JOIN Exams e ON r.ExamID = e.ExamID
        WHERE 1=1
      `;
      let pArgs = [];
      if (role === 'guru') {
          sql += ` AND LOWER(TRIM(u.Sekolah)) = LOWER(TRIM(?))`;
          pArgs.push(sekolah);
      }
      
      const results = await turso.execute({ sql: sql, args: pArgs });
      return NextResponse.json({ status: 'success', data: results.rows });
    }

    if (action === 'getSiswaDetailHasil') {
      const rid = args[0];
      const results = await turso.execute({ sql: "SELECT r.TotalNilai, r.Detail, e.Judul, e.Mapel FROM Results r JOIN Exams e ON r.ExamID = e.ExamID WHERE r.ResultID = ?", args: [rid] });
      return NextResponse.json({ status: 'success', data: results.rows[0] });
    }

    if (action === 'adminUpdateResult') {
       await turso.execute({ sql: "UPDATE Results SET TotalNilai=?, Detail=? WHERE ResultID=?", args: [args[1], args[2], args[0]] });
       return NextResponse.json({ status: 'success', msg: 'Nilai dan Koreksi diperbarui.' });
    }
    
    if (action === 'adminDeleteResult') {
       await turso.execute({ sql: "DELETE FROM Results WHERE ResultID=?", args: [args[0]] });
       return NextResponse.json({ status: 'success', msg: 'Hasil Dihapus!' });
    }

    if (action === 'requestResetResult') {
       await turso.execute({ sql: "UPDATE Results SET Pelanggaran = 'Meminta Reset (Trobel)' WHERE ResultID=?", args: [args[0]] });
       return NextResponse.json({ status: 'success', msg: 'Berhasil dilaporkan' });
    }

    if (action === 'updateClientProgress') {
        return NextResponse.json({ status: 'success' });
    }

    if (action === 'getLiveMonitoring') {
       const [id, role, sekolah] = args;
       let sql = "SELECT * FROM Users WHERE Role='siswa'";
       let pArgs = [];
       if (role === 'guru') { sql += " AND LOWER(TRIM(Sekolah)) = LOWER(TRIM(?))"; pArgs.push(sekolah); }
       
       try {
           const users = await turso.execute({ sql: sql, args: pArgs });
           return NextResponse.json({ 
               status: 'success', 
               data: users.rows.map(u => ({ 
                   id: u.ID, 
                   nama: u.Nama || 'Tanpa Nama', 
                   kelas: u.Kelas || '-', 
                   terjawab: u.Terjawab != null ? u.Terjawab : 0, 
                   total: u.TotalSoal != null && u.TotalSoal > 0 ? u.TotalSoal : 10,
                   status: u.Status || 'Offline' 
               })) 
           });
       } catch (error) {
           return NextResponse.json({ status: 'success', data: [] });
       }
    }

    if (action === 'sysResetCache' || action === 'autosaveAnswer') return NextResponse.json({ status: 'success' });
    
    return NextResponse.json({ status: 'success', data: [] });
  } catch (error) {
    return NextResponse.json({ status: 'error', msg: error.message }, { status: 500 });
  }
}
