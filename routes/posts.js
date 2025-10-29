const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// 글 목록 조회
router.get("/", (req, res) => {
  const query = `
    SELECT p.id, p.title, p.author_id, p.created_at,
           u.username as author_username
    FROM posts p
    JOIN users u ON p.author_id = u.id
    ORDER BY p.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });

    const posts = rows.map((r) => ({
      id: r.id,
      title: r.title,
      author: { id: r.author_id, username: r.author_username || null },
      created_at: r.created_at,
    }));
    res.json({ posts });
  });
});

// 글 상세 조회
router.get("/:id", (req, res) => {
  const postId = req.params.id;
  const query = `
    SELECT p.id, p.title, p.content, p.author_id, p.created_at, p.updated_at,
           u.username as author_username
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `;
  db.get(query, [postId], (err, row) => {
    if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    if (!row) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });

    const post = {
      id: row.id,
      title: row.title,
      content: row.content,
      author: { id: row.author_id, username: row.author_username || null },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    res.json({ post });
  });
});

// 글 작성
router.post("/", requireAuth, (req, res) => {
  const { title, content } = req.body;
  const authorId = req.session.userId;

  if (!title || !content)
    return res.status(400).json({ error: "제목과 내용을 입력해주세요." });

  db.run(
    "INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)",
    [title, content, authorId],
    function (err) {
      if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
      res.status(201).json({ message: "게시글이 작성되었습니다.", postId: this.lastID });
    }
  );
});

// 글 수정
router.put("/:id", requireAuth, (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;
  const userId = req.session.userId;

  if (!title || !content)
    return res.status(400).json({ error: "제목과 내용을 입력해주세요." });

  db.get("SELECT author_id FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    if (post.author_id !== userId)
      return res.status(403).json({ error: "게시글 수정 권한이 없습니다." });

    db.run(
      "UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [title, content, postId],
      function (err) {
        if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
        res.json({ message: "게시글이 수정되었습니다." });
      }
    );
  });
});

// 글 삭제
router.delete("/:id", requireAuth, (req, res) => {
  const postId = req.params.id;
  const userId = req.session.userId;

  db.get("SELECT author_id FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    if (post.author_id !== userId)
      return res.status(403).json({ error: "게시글 삭제 권한이 없습니다." });

    db.run("DELETE FROM posts WHERE id = ?", [postId], function (err) {
      if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
      res.json({ message: "게시글이 삭제되었습니다." });
    });
  });
});

module.exports = router;
