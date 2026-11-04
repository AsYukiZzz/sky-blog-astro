export const imageBody = `## 图片性能验证

<img src="/images/dusk.svg?image=first" alt="首屏正文图" />

<div style={{ height: '20000px' }} aria-hidden="true"></div>

${Array.from({ length: 25 }, (_, index) => `![延迟图片${index}](/images/dusk.svg?image=body-${index})`).join('\n\n')}`;
