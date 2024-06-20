- fork 本仓库
- 拉取fork后的仓库到本地
- 修改 `package.json` 文件中的 `name` 和 `description` 字段
- 将 `README.md` 文件中的内容替换为自己的插件说明。

## 克隆仓库

karin根目录执行以下命令克隆仓库到本地

```bash
git clone https://github.com/pshwuli/karin-plugin-xl.git ./plugins/karin-plugin-xl
```

## 安装依赖

```bash
pnpm install --filter=karin-plugin-xl
```


## 开发调试

```bash
node . --dev
```
