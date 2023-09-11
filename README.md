# vite-plugin-vitepress-auto-nav

自动生成 VitePress 的 nav 与 sidebar 配置

## 🕯️ 使用

安装 vite-plugin-vitepress-auto-sidebar

```bash
# recommend using pnpm packageManager
pnpm i vite-plugin-vitepress-auto-nav -D
# or yarn
yarn add vite-plugin-vitepress-auto-nav -D
# or npm
npm i vite-plugin-vitepress-auto-nav -D
```

添加插件到 `.vitepress/config.ts`

```ts
import AutoNav from 'vite-plugin-vitepress-auto-nav'

export default defineConfig({
  vite: {
    plugins: [
      AutoNav({
        // 可以自定义配置
      }),
    ],
  },
})
```

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
