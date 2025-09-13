// /api/hello.js - teste rápido
module.exports = (req, res) => {
  res.status(200).json({ ok: true, msg: "hello from /api/hello" });
};
