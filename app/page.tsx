'use client';

import { useState, useEffect } from 'react';

export default function Page() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tglLahir, setTglLahir] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // State Sesi tersinkron dengan Turso Database
  const [activeSession, setActiveSession] = useState('Memuat...');
  const [jamSesi1, setJamSesi1] = useState('07.30 - 09.00');
  const [jamSesi2, setJamSesi2] = useState('09.30 - 11.00');
  const [jamSesi3, setJamSesi3] = useState('11.30 - 13.00');

  useEffect(() => {
    const savedUser = localStorage.getItem('cbt_user');
    if (savedUser) {
      window.location.href = '/index.html';
    }

    // Ambil Pengaturan Sesi Aktif & Jam Sesi dari server Turso
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getLandingData', args: [] })
    })
    .then(r => r.json())
    .then(res => {
      if(res.status === 'success') {
         setActiveSession(res.data.SesiAktif || '1');
         setJamSesi1(res.data.JamSesi1 || '07.30 - 09.00');
         setJamSesi2(res.data.JamSesi2 || '09.30 - 11.00');
         setJamSesi3(res.data.JamSesi3 || '11.30 - 13.00');
      }
    })
    .catch(err => console.log('Gagal memuat sesi aktif'));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, tglLahir })
      });
      
      const result = await res.json();

      if (result.status === 'success') {
        const user = result.data;
        user.LogoUrl = result.logo;
        localStorage.setItem('cbt_user', JSON.stringify(user));
        
        window.location.href = '/index.html';
      } else {
        alert('Gagal Login: ' + result.msg);
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan atau server tidak merespons.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />

      <div style={{
        fontFamily: "'Poppins', sans-serif",
        minHeight: '100vh',
        width: '100%',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: "linear-gradient(135deg, #064e3b 0%, #15803d 50%, #d4af37 100%)",
        padding: '20px'
      }}>
        
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div className="row g-4 align-items-center">
            
            {/* --- BAGIAN KIRI (INFO) --- */}
            <div className="col-lg-7 text-white pe-lg-4 mb-4 mb-lg-0">
              <h2 className="fw-bold mb-3" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>Tryout TKA KKGMI Surabaya 10</h2>
              <p className="lead mb-4" style={{ fontSize: '1.1rem', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
                Selamat datang di Aplikasi Computer Based Test (CBT) resmi Kelompok Kerja Guru Madrasah Ibtidaiyah (KKGMI) Kota Surabaya 10.
              </p>
              
              {/* --- KOTAK ATURAN --- */}
              <div className="bg-white text-dark p-4 rounded-4 shadow-sm mb-4" style={{ opacity: 0.95 }}>
                <h5 className="fw-bold text-success mb-3"><i className="fas fa-list-check me-2"></i>Aturan & Cara Mengerjakan</h5>
                <ol className="mb-0 small text-muted" style={{ paddingLeft: '1.2rem', lineHeight: '1.7' }}>
                  <li className="mb-1">Pastikan koneksi internet Anda stabil sebelum mulai ujian.</li>
                  <li className="mb-1">Sistem akan otomatis beralih ke mode <strong className="text-dark">Layar Penuh (Fullscreen)</strong>.</li>
                  <li className="mb-1"><strong className="text-danger">DILARANG</strong> membuka tab baru, aplikasi lain, atau membagi layar (Split Screen). Pelanggaran maksimal 3 kali akan membuat jawaban otomatis terkirim.</li>
                  <li>Tombol <strong className="text-dark">Selesai Ujian</strong> hanya akan muncul di soal nomor terakhir. Gunakan tombol <strong className="text-warning text-darken">Ragu-ragu</strong> jika ingin menandai soal yang belum yakin.</li>
                </ol>
              </div>

              {/* --- KOTAK JADWAL & SESI --- */}
<div className="bg-white text-dark p-4 rounded-4 shadow-sm" style={{ opacity: 0.95 }}>
  <div className="d-flex justify-content-between align-items-center mb-3">
    <h5 className="fw-bold text-success m-0">
      <i className="fas fa-calendar-alt me-2"></i>Jadwal Pelaksanaan
    </h5>
    <span className="badge bg-danger px-3 py-2 fs-6 rounded-pill shadow-sm heartbeat-animation">
      Sesi Aktif: {activeSession === 'ALL' ? 'Semua Sesi' : `Sesi ${activeSession}`}
    </span>
  </div>
  
  {/* Semua kolom Tryout dibungkus dalam satu row di sini */}
  <div className="row g-3 mb-3">
    
    {/* Tryout 1 */}
    <div className="col-md-6">
      <div className="p-3 bg-light rounded-3 border h-100 shadow-sm">
        <h6 className="fw-bold text-primary mb-2 border-bottom pb-2">
          Tryout 1 <br/>
          <small className="text-muted fw-normal" style={{fontSize: '12px'}}>17 - 20 November 2026</small>
        </h6>
        <div className="small text-muted" style={{ lineHeight: '1.6' }}>
          <div className="mb-2">
            <strong className="text-dark"><i className="fas fa-angle-right text-success me-1"></i>Gelombang 1:</strong><br/>17 - 18 November 2026
          </div>
          <div>
            <strong className="text-dark"><i className="fas fa-angle-right text-success me-1"></i>Gelombang 2:</strong><br/>19 - 20 November 2026
          </div>
        </div>
      </div>
    </div>
    
    {/* Tryout 2 */}
    <div className="col-md-6">
      <div className="p-3 bg-light rounded-3 border h-100 shadow-sm">
        <h6 className="fw-bold text-primary mb-2 border-bottom pb-2">
          Tryout 2 <br/>
          <small className="text-muted fw-normal" style={{fontSize: '12px'}}>25 - 28 Jan 2027</small>
        </h6>
        <div className="small text-muted" style={{ lineHeight: '1.6' }}>
          <div className="mb-2">
            <strong className="text-dark"><i className="fas fa-angle-right text-success me-1"></i>Gelombang 1:</strong><br/>25 - 26 Januari 2027
          </div>
          <div>
            <strong className="text-dark"><i className="fas fa-angle-right text-success me-1"></i>Gelombang 2:</strong><br/>27 - 28 Januari 2027
          </div>
        </div>
      </div>
    </div>

    {/* Tryout 3 */}
    <div className="col-md-6">
      <div className="p-3 bg-light rounded-3 border h-100 shadow-sm">
        <h6 className="fw-bold text-primary mb-2 border-bottom pb-2">
          Tryout 3 <br/>
          <small className="text-muted fw-normal" style={{fontSize: '12px'}}>5 - 8 April 2027</small>
        </h6>
        <div className="small text-muted" style={{ lineHeight: '1.6' }}>
          <div className="mb-2">
            <strong className="text-dark"><i className="fas fa-angle-right text-success me-1"></i>Gelombang 1:</strong><br/>5 - 6 April 2027
          </div>
          <div>
            <strong className="text-dark"><i className="fas fa-angle-right text-success me-1"></i>Gelombang 2:</strong><br/>7 - 8 April 2027
          </div>
        </div>
      </div>
    </div>
    
  </div>
</div>

                {/* Blok Sesi (Dinamis dari Database) */}
                <div className="p-3 rounded-3 border" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div className="fw-bold text-success mb-2 small"><i className="fas fa-clock me-1"></i> Waktu Sesi (Berlaku Semua Gelombang):</div>
                  <div className="d-flex flex-wrap gap-2 small">
                    <span className={`badge border px-3 py-2 shadow-sm ${activeSession === '1' ? 'bg-success text-white border-success' : 'bg-white text-success border-success'}`} style={{ fontSize: '13px' }}>Sesi 1: {jamSesi1}</span>
                    <span className={`badge border px-3 py-2 shadow-sm ${activeSession === '2' ? 'bg-success text-white border-success' : 'bg-white text-success border-success'}`} style={{ fontSize: '13px' }}>Sesi 2: {jamSesi2}</span>
                    <span className={`badge border px-3 py-2 shadow-sm ${activeSession === '3' ? 'bg-success text-white border-success' : 'bg-white text-success border-success'}`} style={{ fontSize: '13px' }}>Sesi 3: {jamSesi3}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* --- BAGIAN KANAN (LOGIN) --- */}
            <div className="col-lg-5">
              <div style={{
                background: 'white',
                borderRadius: '20px',
                boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
                width: '100%',
                padding: '40px',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch'
              }}>
                
                <div className="text-center mb-4">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1SCvmdQxuqmX_f0gBaYt0Ob53Tws97Hnq" 
                    className="mx-auto d-block mb-3 rounded" 
                    width="90" 
                    alt="Logo KKGMI" 
                  />
                  <h4 className="fw-bold text-center" style={{ color: '#064e3b', fontSize: '22px' }}>
                    MASUK UJIAN
                  </h4>
                </div>

                <form onSubmit={handleLogin} style={{ width: '100%' }}>
                  <div className="form-floating mb-3">
                    <input 
                      type="text" 
                      className="form-control bg-light border-0" 
                      placeholder="User" 
                      required 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                    />
                    <label>Username</label>
                  </div>

                  <div className="form-floating mb-3 position-relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="form-control bg-light border-0" 
                      placeholder="Pass" 
                      required 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                    />
                    <label>Password</label>
                    <i 
                      className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} position-absolute top-50 end-0 translate-middle-y me-3 text-muted`} 
                      style={{ cursor: 'pointer', zIndex: 10, fontSize: '1.2rem' }}
                      onClick={() => setShowPassword(!showPassword)}
                    ></i>
                  </div>

                  <div className="form-floating mb-4">
                    <input 
                      type="date" 
                      className="form-control bg-light border-0" 
                      value={tglLahir} 
                      onChange={(e) => setTglLahir(e.target.value)} 
                    />
                    <label>Tanggal Lahir (Siswa Wajib Isi)</label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="btn w-100 py-3 fw-bold shadow-sm text-white"
                    style={{ background: 'linear-gradient(90deg, #064e3b 0%, #15803d 100%)', border: 'none', fontSize: '16px', borderRadius: '10px' }}
                  >
                    {loading ? 'MEMPROSES...' : 'MASUK SEKARANG'}
                  </button>
                </form>

                <div className="text-center mt-4 small text-muted">
                  © 2026 KKGMI SURABAYA 10<br/>@support by Belajar Inovasi
                </div>
              </div>
            </div>
            
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes heartbeat {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          .heartbeat-animation { animation: heartbeat 2s infinite ease-in-out; }
        `}} />
      </div>
    </>
  );
}
