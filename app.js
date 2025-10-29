// server.js
const express = require("express");
const session = require("express-session");
const cors = require("cors"); // 동일 출처(예: frontend가 same origin)라면 불필요
const SQLiteStore = require("connect-sqlite3")(session);
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const { db } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// cors 설정
const corsOptions = { origin: "http://localhost:5173", credentials: true };
app.use(cors(corsOptions));

// 세션 설정 (SQLiteStore 사용)
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: "./",
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // HTTPS 환경에서는 true로 변경
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24시간
    },
  })
);

app.use("/api/auth", authRoutes)
app.use("/api/posts", postRoutes)

// 헬스 체크
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// 404 처리
app.use("*", (req, res) => {
  res.status(404).json({ error: "요청한 리소스를 찾을 수 없습니다." });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});
