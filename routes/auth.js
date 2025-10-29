const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// 헬퍼: ID로 사용자 조회
const getUserById = (id) =>
  new Promise((resolve, reject) => {
    db.get("SELECT id, username, email FROM users WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

// 회원가입
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  if (password.length < 6)
    return res.status(400).json({ error: "비밀번호는 최소 6자 이상이어야 합니다." });

  try {
    const hashed = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashed],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({ error: "이미 존재하는 사용자명 또는 이메일입니다." });
          }
          return res.status(500).json({ error: "서버 오류가 발생했습니다." });
        }
        res.status(201).json({ message: "회원가입 완료", userId: this.lastID });
      }
    );
  } catch {
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 로그인
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    if (!user) return res.status(401).json({ error: "잘못된 이메일 또는 비밀번호입니다." });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "잘못된 이메일 또는 비밀번호입니다." });

    req.session.userId = user.id;
    res.json({
      message: "로그인 성공",
      user: { id: user.id, username: user.username, email: user.email },
    });
  });
});

// 로그아웃
router.post("/logout", (req, res) => {
  if (!req.session) {
    res.clearCookie("connect.sid")
    return res.json({ message: "이미 로그아웃된 상태입니다." });
  }
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "로그아웃 중 오류 발생" });
    res.clearCookie("connect.sid");
    res.json({ message: "로그아웃되었습니다." });
  });
});

// 내 정보
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.session.userId);
    if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    res.json({ user });
  } catch {
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;
