export default {
  async paths() {
    return [
      {
        params: { slug: 'hello-world' },
        content: '\n## root 内容\n',
      },
      {
        params: { slug: 'release-note' },
      },
    ]
  },
}
