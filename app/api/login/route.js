import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  try {
    const { username, password, tglLahir } = await req.json();

    // PERBAIKAN: CAST(Password AS TEXT) agar angka 1234 dari Excel tetap cocok dengan string '1234'
    const result = await turso.execute({
      sql: "SELECT * FROM Users WHERE Username = ? AND CAST(Password AS TEXT) = ?",
      args: [username, password]
    });

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const role = String(user.Role).trim().toLowerCase();

      // Cek Tanggal Lahir HANYA jika yang login adalah siswa
      if (role === 'siswa') {
        const dbTgl = String(user.TglLahir || '').trim();
        const inputTgl = String(tglLahir || '').trim();
        if (dbTgl !== inputTgl) {
          return NextResponse.json({ status: 'error', msg: 'Tanggal Lahir salah untuk akun Anda!' });
        }
      }

      const token = jwt.sign(
        { id: user.ID, role: user.Role },
        process.env.JWT_SECRET || 'rahasia_super_aman_cbt_123',
        { expiresIn: '6h' }
      );

      return NextResponse.json({
        status: 'success',
        data: user,
        token: token,
        logo: 'https://lh3.googleusercontent.com/d/1SCvmdQxuqmX_f0gBaYt0Ob53Tws97Hnq'
      });
    }

    return NextResponse.json({ status: 'error', msg: 'Username atau Password salah!' });
    
  } catch (error) {
    console.error("API Login Error:", error);
    return NextResponse.json({ status: 'error', msg: error.message }, { status: 500 });
  }
}
