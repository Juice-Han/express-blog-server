// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcryptjs");
const cors = require("cors"); // 동일 출처(예: frontend가 same origin)라면 불필요
const SQLiteStore = require("connect-sqlite3")(session);

const app = express();
const PORT = process.env.PORT || 3000;

// 데이터베이스 초기화
const db = new sqlite3.Database("./blog.db", (err) => {
  if (err) {
    console.error("데이터베이스 연결 오류:", err.message);
  } else {
    console.log("SQLite 데이터베이스에 연결되었습니다.");
  }
});

// 테이블 생성
db.serialize(() => {
  // 사용자 테이블
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 게시글 테이블
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users (id)
  )`);
});

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 만약 프론트가 다른 포트/도메인에서 동작하면 cors를 켜고 origin을 설정하세요.
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

// 인증 미들웨어
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }
  next();
};

// 사용자 정보를 가져오는 헬퍼 함수
const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT id, username, email FROM users WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// API 라우트

// 1. 회원가입
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "비밀번호는 최소 6자 이상이어야 합니다." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({ error: "이미 존재하는 사용자명 또는 이메일입니다." });
          }
          return res.status(500).json({ error: "서버 오류가 발생했습니다." });
        }

        res.status(201).json({
          message: "회원가입이 완료되었습니다.",
          userId: this.lastID,
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 2. 로그인
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }

    if (!user) {
      return res.status(401).json({ error: "잘못된 이메일 또는 비밀번호입니다." });
    }

    try {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "잘못된 이메일 또는 비밀번호입니다." });
      }

      req.session.userId = user.id;
      res.json({
        message: "로그인 성공",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
});

// 3. 로그아웃
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "로그아웃 중 오류가 발생했습니다." });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "로그아웃되었습니다." });
  });
});

// 4. 현재 사용자 정보 조회
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 5. 글 목록 조회 (응답 형태를 상세와 일치시킴; 다만 content는 요약하여 반환)
app.get("/api/posts", (req, res) => {
  const query = `
    SELECT p.id, p.title, p.author_id, p.created_at,
           u.username as author_username
    FROM posts p
    JOIN users u ON p.author_id = u.id
    ORDER BY p.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }

    // 목록에서는 content를 요약(excerpt)하도록 설정 (예: 200자)
    const excerptLength = 200;
    const posts = rows.map((r) => ({
      id: r.id,
      title: r.title,
      author: {
        id: r.author_id,
        username: r.author_username || null,
      },
      created_at: r.created_at
    }));

    res.json({ posts });
  });
});

// 6. 글 상세 조회 (목록과 동일한 키 구조, content는 전체)
app.get("/api/posts/:id", (req, res) => {
  const postId = req.params.id;

  const query = `
    SELECT p.id, p.title, p.content, p.author_id, p.created_at, p.updated_at,
           u.username as author_username
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `;

  db.get(query, [postId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }

    if (!row) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }

    const post = {
      id: row.id,
      title: row.title,
      content: row.content,
      author: {
        id: row.author_id,
        username: row.author_username || null,
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    res.json({ post });
  });
});

// 7. 글 작성
app.post("/api/posts", requireAuth, (req, res) => {
  const { title, content } = req.body;
  const authorId = req.session.userId;

  if (!title || !content) {
    return res.status(400).json({ error: "제목과 내용을 입력해주세요." });
  }

  db.run(
    "INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)",
    [title, content, authorId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "서버 오류가 발생했습니다." });
      }

      res.status(201).json({
        message: "게시글이 작성되었습니다.",
        postId: this.lastID,
      });
    }
  );
});

// 8. 글 수정
app.put("/api/posts/:id", requireAuth, (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;
  const userId = req.session.userId;

  if (!title || !content) {
    return res.status(400).json({ error: "제목과 내용을 입력해주세요." });
  }

  // 게시글 작성자 확인
  db.get("SELECT author_id FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err) {
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }

    if (!post) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }

    if (post.author_id !== userId) {
      return res.status(403).json({ error: "게시글 수정 권한이 없습니다." });
    }

    // 게시글 수정
    db.run(
      "UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [title, content, postId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "서버 오류가 발생했습니다." });
        }

        res.json({ message: "게시글이 수정되었습니다." });
      }
    );
  });
});

// 9. 글 삭제
app.delete("/api/posts/:id", requireAuth, (req, res) => {
  const postId = req.params.id;
  const userId = req.session.userId;

  // 게시글 작성자 확인
  db.get("SELECT author_id FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err) {
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }

    if (!post) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }

    if (post.author_id !== userId) {
      return res.status(403).json({ error: "게시글 삭제 권한이 없습니다." });
    }

    // 게시글 삭제
    db.run("DELETE FROM posts WHERE id = ?", [postId], function (err) {
      if (err) {
        return res.status(500).json({ error: "서버 오류가 발생했습니다." });
      }

      res.json({ message: "게시글이 삭제되었습니다." });
    });
  });
});

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
