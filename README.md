# 一万小时理论计时器（Ten‑Thousand‑Hours Timer（一万小时计时器））

一个纯静态（Static（静态））网页应用，帮助你按照“刻意练习（Deliberate practice（刻意练习））”记录并累计不同技术（Tech（技术））的练习时长，支持背景图片（Background image（背景图片））与多种适配模式（Fit modes（适配模式）），数据保存在浏览器本地（localStorage（本地存储）），可导出/导入（Export/Import（导出/导入））。



## 功能特性（Features（功能））
- 技术维度计时与展示：可新增、计时、暂停并统计累计时长。
- 背景图片上传与应用：支持适配模式与滚动行为。
  - 背景适配模式（Background fit（背景适配））：覆盖（cover（覆盖））/ 包含（contain（包含））/ 拉伸（stretch（拉伸））。
  - 背景滚动行为（Background attachment（背景滚动））：固定（fixed（固定））/ 跟随滚动（scroll（跟随滚动））。
- 数据持久化（Persistence（持久化））：自动保存在浏览器的 localStorage（本地存储）。
- 导出/导入（Export/Import（导出/导入））：将当前数据导出为 JSON（数据文件），或从 JSON（数据文件）导入。

## 目录结构（Project structure（项目结构））
- index.html：主页面（入口）。
- styles.css：样式文件（包含选择框与按钮的主题风格）。
- script.js：交互逻辑（包含计时与背景配置）。
- icon-app.svg / icon-app-blue.svg / icon-32.svg：图标（可用于快捷方式或收藏夹）。


## 快速开始（Quick start（快速开始））
直接双击 index.html 在浏览器打开使用。


## 使用指南（Usage guide（使用指南））
- 计时与管理：
  - 新增技术条目（Add tech（新增技术）），开始/暂停计时（Start/Pause（开始/暂停））。
  - 累计时长会自动保存到 localStorage（本地存储）。
- 背景设置（Background settings（背景设置））：
  - 上传背景图（Upload background（上传背景））后，可在“背景适应模式（Fit（适应））”与“背景滚动行为（Attachment（滚动行为））”中进行选择。
  - 清除背景图（Clear background（清除背景））可恢复默认渐变背景。
- 数据导出/导入：
  - 导出（Export（导出））：生成 JSON（数据文件）。若不希望文件过大，可先“移除背景图（Remove background（移除背景））”后再导出。
  - 导入（Import（导入））：选择已导出的 JSON（数据文件）即可恢复数据。

## 注意事项（Notes（注意事项））
- 数据隔离：每位用户的数据都保存在自己设备的浏览器 localStorage（本地存储）中，互不影响。
- 体积与性能：如果背景图很大，导出的 JSON（数据文件）体积也会变大；建议根据需要清除背景图后再导出。
- 样式差异：不同操作系统与浏览器对 select（下拉选择框）和 option（选项）的渲染可能不同，这是正常现象。


