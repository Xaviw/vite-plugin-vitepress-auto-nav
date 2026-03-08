export default {
  async paths() {
    return [
      {
        params: { year: '2024', slug: 'hello-world' },
        content: '\n## 2024 Hello World\n\n这段内容来自多段动态路由 loader。\n',
      },
      {
        params: { year: '2025', slug: 'release-note' },
      },
    ]
  },
}
