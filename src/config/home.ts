import { defineHome } from '../lib/home-layout';

// 唯一基础预设；需要定制时按断点覆盖参数或完整 areas 模板。
// disabled 在所有断点关闭指定卡片。
export const home = defineHome({
    preset: 'default',
});
