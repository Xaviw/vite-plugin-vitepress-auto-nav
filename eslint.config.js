import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [],
  type: 'lib',
  rules: {
    'no-console': 'off',
  },
})
