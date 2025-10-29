const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "http://localhost:5173"}));

// 라우트 연결
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

// 헬스 체크
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// 404 핸들러
app.use("*", (req, res) => {
  res.status(404).json({ error: "요청한 리소스를 찾을 수 없습니다." });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error("🔥 에러 발생:", err.stack);
  res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
});

// 서버 실행
app.listen(PORT, () => console.log(`🚀 서버 실행 중: http://localhost:${PORT}`));
