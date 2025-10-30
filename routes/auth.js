const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

// 회원가입
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });

  if (password.length < 6)
    return res.status(400).json({ error: "비밀번호는 최소 6자 이상이어야 합니다." });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed"))
            return res.status(409).json({ error: "이미 존재하는 사용자명 또는 이메일입니다." });
          return res.status(500).json({ error: "서버 오류가 발생했습니다." });
        }

        const token = jwt.sign(
          { id: this.lastID, username, email },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        res.status(201).json({
          message: "회원가입이 완료되었습니다.",
          token,
          user: { id: this.lastID, username, email },
        });
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
    if (err) return res.status(500).json({ error: "서버 오류" });
    if (!user) return res.status(401).json({ error: "잘못된 이메일 또는 비밀번호입니다." });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "잘못된 이메일 또는 비밀번호입니다." });

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    res.json({
      message: "로그인 성공",
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  });
});

// 로그아웃
router.post("/logout", (req, res) => {
  res.json({ message: "로그아웃되었습니다. 클라이언트에서 토큰을 삭제하세요." });
});

module.exports = router;
