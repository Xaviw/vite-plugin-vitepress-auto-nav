export default {
  async paths() {
    return [
      {
        params: { slug: 'hello-world' },
        content: '\n## 来自 paths.ts 的内容\n\n这段内容来自动态路由 loader。\n',
      },
      {
        params: { slug: 'release-note' },
      },
    ]
  },
}
