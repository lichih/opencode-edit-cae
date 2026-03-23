import fs from 'fs';

export function getReplaceLogic(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // 提取 replace 函數及其上方所有相依的 Replacer 和 helper
  const logicBlock = content.substring(content.indexOf('export type Replacer'));
  // 將 export 關鍵字去掉以便 eval
  const runnableLogic = logicBlock.replace(/export /g, '');
  return new Function('content', 'oldString', 'newString', 'replaceAll', `
    ${runnableLogic}
    return replace(content, oldString, newString, replaceAll);
  `);
}
