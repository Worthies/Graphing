import type { Messages } from './en';

// Simplified Chinese. Typed as Messages: any missing/extra key is a compile error.
const zhCN: Messages = {
  toolbar: {
    modes: {
      select: '选择 ({{shortcut}})',
      rect: '矩形 ({{shortcut}})',
      ellipse: '椭圆 ({{shortcut}})',
      line: '直线 ({{shortcut}})',
      polyline: '折线 ({{shortcut}})',
      path: '路径 ({{shortcut}})',
      text: '文本 ({{shortcut}})',
      image: '图像 ({{shortcut}})'
    },
    operations: {
      undo: '撤销 ({{shortcut}})',
      redo: '重做 ({{shortcut}})',
      reload: '从文本编辑器重新加载 SVG',
      delete: '删除',
      duplicate: '复制 ({{shortcut}})',
      group: '组合 ({{shortcut}})',
      ungroup: '取消组合 ({{shortcut}})',
      bringForward: '上移一层 ({{shortcut}})',
      sendBackward: '下移一层 ({{shortcut}})',
      alignLeft: '左对齐',
      alignRight: '右对齐',
      alignTop: '顶部对齐',
      alignBottom: '底部对齐',
      rotateClockwise: '顺时针旋转 ({{shortcut}})',
      rotateCounterclockwise: '逆时针旋转 ({{shortcut}})',
      zoomIn: '放大 ({{shortcut}})',
      zoomOut: '缩小 ({{shortcut}})',
      centerVertical: '垂直居中',
      centerHorizontal: '水平居中',
      polygonToRect: '多边形转为矩形',
      fitCanvasToContent: '画布适配内容',
      copyAsPng: '复制为 PNG 到剪贴板',
      toggleBackground: '切换背景颜色'
    },
    groups: { draw: '绘图', operations: '操作' }
  },
  stylePanel: {
    sections: {
      canvas: '画布',
      viewBox: '视框',
      element: '元素',
      positionSize: '位置与尺寸',
      content: '内容',
      style: '样式',
      font: '字体',
      transform: '变换',
      opacity: '不透明度'
    },
    fields: {
      id: 'ID', tag: '标签',
      x: 'X', y: 'Y', width: '宽度', height: '高度',
      cx: '圆心 X', cy: '圆心 Y', r: '半径', rx: '半径 X', ry: '半径 Y',
      x1: 'X1', y1: 'Y1', x2: 'X2', y2: 'Y2',
      minX: '最小 X', minY: '最小 Y',
      points: '点集', path: '路径', text: '文本',
      fill: '填充', fillOpacity: '填充不透明度',
      stroke: '描边', strokeWidth: '描边宽度', strokeOpacity: '描边不透明度',
      family: '字体族', size: '字号', weight: '字重', fontStyle: '字体样式',
      transform: '变换', opacity: '不透明度'
    },
    noText: '(无文本)'
  },
  errors: {
    webviewError: 'SVG 编辑器错误：{{detail}}',
    svgParseError: 'SVG 解析错误：{{detail}}',
    svgLoadFailed: '无法加载 SVG：{{reason}}',
    svgRenderError: 'SVG 渲染错误：{{detail}}',
    unknownWebviewError: '未知的 Webview 错误',
    unhandledRejection: '未处理的 Promise 拒绝',
    svgcanvasRejected: 'svgcanvas 拒绝了该 SVG'
  }
};

export default zhCN;
