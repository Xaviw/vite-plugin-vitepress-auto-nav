export default {
  async paths() {
    return [
      {
        params: { slug: 'bonjour' },
        content: '\n## contenu fr\n',
      },
      {
        params: { slug: 'annonce' },
      },
    ]
  },
}
