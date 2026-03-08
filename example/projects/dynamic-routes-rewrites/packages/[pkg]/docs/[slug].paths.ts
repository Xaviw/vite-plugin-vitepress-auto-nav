export default {
  async paths() {
    return [
      {
        params: { pkg: 'alpha', slug: 'overview' },
        content: '\n## alpha overview\n',
      },
      {
        params: { pkg: 'beta', slug: 'install' },
      },
    ]
  },
}
