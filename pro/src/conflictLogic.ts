import isEqual from "lodash/isEqual";
import {
  LCS,
  mergeDigIn,
} from "node-diff3";
import type { Entity } from "../../src/baseTypes";
import { copyFile } from "../../src/copyLogic";
import type { FakeFs } from "../../src/fsAll";
import { MERGABLE_SIZE } from "./baseTypesPro";

export function isMergable(a: Entity, b?: Entity) {
  if (b !== undefined && a.key !== b.key) {
    return false;
  }

  return (
    !a.key!.endsWith("/") &&
    a.sizeRaw <= MERGABLE_SIZE &&
    (a.key!.endsWith(".md") || a.key!.endsWith(".markdown"))
  );
}

export function generateConflictCopyPath(key: string, suffix = "remote"): string {
  const parts = key.split('/');
  const fileName = parts.pop() || '';
  const nameParts = fileName.split('.');
  const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
  const baseName = nameParts.join('.');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffixPart = suffix ? `-${suffix}` : '';
  
  const newFileName = `${baseName}.sync-conflict${suffixPart}-${timestamp}${ext}`;
  parts.push(newFileName);
  return parts.join('/');
}

export function splitFrontmatterAndBody(content: string): { frontmatter: string | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (match && content.startsWith(match[0])) {
    return { frontmatter: match[1], body: content.slice(match[0].length) };
  }
  return { frontmatter: null, body: content };
}

export function parseSimpleYaml(yamlText: string): Record<string, any> {
  const obj: Record<string, any> = {};
  const lines = yamlText.split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      obj[key] = value;
    }
  }
  return obj;
}

export function mergeYamlObjects(leftObj: any, rightObj: any, origObj: any = {}): any {
  const result: any = { ...origObj };
  const allKeys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj), ...Object.keys(origObj)]);
  
  for (const key of allKeys) {
    const leftHas = key in leftObj;
    const rightHas = key in rightObj;
    const origHas = key in origObj;
    
    if (leftHas && rightHas) {
      if (leftObj[key] !== rightObj[key]) {
        result[key] = leftObj[key];
      } else {
        result[key] = leftObj[key];
      }
    } else if (leftHas && !rightHas) {
      if (origHas && origObj[key] === leftObj[key]) {
        delete result[key];
      } else {
        result[key] = leftObj[key];
      }
    } else if (!leftHas && rightHas) {
      if (origHas && origObj[key] === rightObj[key]) {
        delete result[key];
      } else {
        result[key] = rightObj[key];
      }
    } else if (!leftHas && !rightHas) {
        delete result[key];
    }
  }
  return result;
}

export function stringifySimpleYaml(obj: any): string {
  if (Object.keys(obj).length === 0) return "";
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    lines.push(`${key}: ${value}`);
  }
  return lines.join('\n');
}

export interface SmartMergeResult {
  mergedText: string;
  hasConflict: boolean;
}

export function smartMergeMarkdown(leftText: string, rightText: string, origText?: string | null): SmartMergeResult {
  const leftParts = splitFrontmatterAndBody(leftText);
  const rightParts = splitFrontmatterAndBody(rightText);
  const origParts = origText ? splitFrontmatterAndBody(origText) : { frontmatter: null, body: "" };

  let mergedYaml = "";
  if (leftParts.frontmatter !== null || rightParts.frontmatter !== null) {
    const leftYaml = leftParts.frontmatter ? parseSimpleYaml(leftParts.frontmatter) : {};
    const rightYaml = rightParts.frontmatter ? parseSimpleYaml(rightParts.frontmatter) : {};
    const origYaml = origParts.frontmatter ? parseSimpleYaml(origParts.frontmatter) : {};
    
    const mergedObj = mergeYamlObjects(leftYaml, rightYaml, origYaml);
    mergedYaml = stringifySimpleYaml(mergedObj);
    if (mergedYaml.length > 0) {
      mergedYaml = `---\n${mergedYaml}\n---\n`;
    }
  }

  let bodyConflict = false;
  let mergedBody = "";
  
  if (!origText) {
    mergedBody = twoWayMerge(leftParts.body, rightParts.body);
  } else {
    mergedBody = threeWayMerge(leftParts.body, rightParts.body, origParts.body);
  }

  if (mergedBody.includes("<<<<<<<") && mergedBody.includes("=======") && mergedBody.includes(">>>>>>>")) {
    bodyConflict = true;
  }

  return {
    mergedText: `${mergedYaml}${mergedBody}`,
    hasConflict: bodyConflict
  };
}

function mergeDigInModified(a: string, o: string, b: string) {
  const { conflict, result } = mergeDigIn(a, o, b, {
    stringSeparator: /\n/,
  });
  for (let index = 0; index < result.length; ++index) {
    if (["<<<<<<<", "=======", ">>>>>>>"].includes(result[index])) {
      result[index] = "`" + result[index] + "`";
    }
  }
  return {
    conflict,
    result,
  };
}

function getLCSText(a: string, b: string) {
  const aa = a.split("\n");
  const bb = b.split("\n");
  let raw = LCS(aa, bb);

  const k: string[] = [];

  do {
    k.unshift(aa[raw.buffer1index]);

    raw = raw.chain as any;
  } while (raw !== null && raw !== undefined && raw.buffer1index !== -1);

  return k.join("\n");
}

export function twoWayMerge(a: string, b: string): string {
  const aa = a.trim();
  const bb = b.trim();
  if (aa === "" && bb === "") {
    return aa.length >= bb.length ? a : b;
  }
  if (bb === "") {
    return a;
  }
  if (aa === "") {
    return b;
  }

  const c = getLCSText(a, b);
  const d = mergeDigInModified(a, c, b).result.join("\n");
  return d;
}

export function threeWayMerge(a: string, b: string, orig: string) {
  return mergeDigInModified(a, orig, b).result.join("\n");
}

export interface MergeFileResult {
  entity: Entity;
  content: ArrayBuffer;
  conflictCopyCreated: boolean;
  conflictCopyKey?: string;
  conflictCopyEntity?: Entity;
}

export async function mergeFile(
  key: string,
  left: FakeFs,
  right: FakeFs,
  contentOrig: ArrayBuffer | null | undefined
): Promise<MergeFileResult> {
  if (key.endsWith("/")) {
    throw Error(`should not call ${key} in mergeFile`);
  }

  if (!key.endsWith(".md") && !key.endsWith(".markdown")) {
    throw Error(`currently only support markdown files in mergeFile`);
  }

  const [contentLeft, contentRight] = await Promise.all([
    left.readFile(key),
    right.readFile(key),
  ]);

  let newArrayBuffer: ArrayBuffer | undefined = undefined;
  let conflictCopyCreated = false;
  let conflictCopyKey: string | undefined = undefined;
  let conflictCopyEntity: Entity | undefined = undefined;
  const decoder = new TextDecoder("utf-8");

  const mtime = Date.now();

  if (isEqual(contentLeft, contentRight)) {
    newArrayBuffer = contentLeft;
    const rightEntity = await right.writeFile(key, newArrayBuffer, mtime, mtime);
    const leftEntity = await left.writeFile(
      key,
      newArrayBuffer,
      rightEntity.mtimeCli ?? mtime,
      rightEntity.ctimeCli ?? rightEntity.mtimeCli ?? mtime
    );
    return {
      entity: rightEntity,
      content: newArrayBuffer,
      conflictCopyCreated: false
    };
  } else {
    const leftText = decoder.decode(contentLeft);
    const rightText = decoder.decode(contentRight);
    const origText = contentOrig ? decoder.decode(contentOrig) : null;
    
    const mergeResult = smartMergeMarkdown(leftText, rightText, origText);
    
    if (mergeResult.hasConflict) {
      newArrayBuffer = new TextEncoder().encode(leftText).buffer;
      
      conflictCopyCreated = true;
      conflictCopyKey = generateConflictCopyPath(key, "remote");
      
      const rightEntity = await right.writeFile(key, newArrayBuffer, mtime, mtime);
      const leftEntity = await left.writeFile(
        key,
        newArrayBuffer,
        rightEntity.mtimeCli ?? mtime,
        rightEntity.ctimeCli ?? rightEntity.mtimeCli ?? mtime
      );
      
      conflictCopyEntity = await left.writeFile(
        conflictCopyKey,
        contentRight,
        mtime,
        mtime
      );
      
      return {
        entity: rightEntity,
        content: newArrayBuffer,
        conflictCopyCreated,
        conflictCopyKey,
        conflictCopyEntity
      };
    } else {
      newArrayBuffer = new TextEncoder().encode(mergeResult.mergedText).buffer;
      
      const rightEntity = await right.writeFile(key, newArrayBuffer, mtime, mtime);
      const leftEntity = await left.writeFile(
        key,
        newArrayBuffer,
        rightEntity.mtimeCli ?? mtime,
        rightEntity.ctimeCli ?? rightEntity.mtimeCli ?? mtime
      );
      
      return {
        entity: rightEntity,
        content: newArrayBuffer,
        conflictCopyCreated: false
      };
    }
  }
}

export function getFileRenameForDup(key: string) {
  if (
    key === "" ||
    key === "." ||
    key === ".." ||
    key === "/" ||
    key.endsWith("/")
  ) {
    throw Error(`we cannot rename key=${key}`);
  }

  const segsPath = key.split("/");
  const name = segsPath[segsPath.length - 1];
  const segsName = name.split(".");

  if (segsName.length === 0) {
    throw Error(`we cannot rename key=${key}`);
  } else if (segsName.length === 1) {
    // name = "kkk" without any dot
    segsPath[segsPath.length - 1] = `${name}.dup`;
  } else if (segsName.length === 2) {
    if (segsName[0] === "") {
      // name = ".kkkk" with leading dot
      segsPath[segsPath.length - 1] = `${name}.dup`;
    } else if (segsName[1] === "") {
      // name = "kkkk." with tailing dot
      segsPath[segsPath.length - 1] = `${segsName[0]}.dup`;
    } else {
      // name = "aaa.bbb" normally
      segsPath[segsPath.length - 1] = `${segsName[0]}.dup.${segsName[1]}`;
    }
  } else {
    // name = "[...].bbb.ccc"
    const firstPart = segsName.slice(0, segsName.length - 1).join(".");
    const thirdPart = segsName[segsName.length - 1];
    segsPath[segsPath.length - 1] = `${firstPart}.dup.${thirdPart}`;
  }
  const res = segsPath.join("/");
  return res;
}

function arraysAreEqual(arr1: ArrayBuffer, arr2: ArrayBuffer) {
  if (arr1.byteLength !== arr2.byteLength) {
    return false;
  }
  const u1 = new Uint8Array(arr1);
  const u2 = new Uint8Array(arr2);

  for (let i = 0; i < u1.byteLength; ++i) {
    if (u1[i] !== u2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * 1. download remote
 * 2. compare
 * 3. if the same, update local but not upload
 * 4. if not the same, rename local and save remote
 */
async function tryDuplicateFileForSameSizes(
  key: string,
  key2: string,
  fsLocal: FakeFs,
  fsRemote: FakeFs,
  uploadCallback: (entity: Entity | undefined) => Promise<any>,
  downloadCallback: (entity: Entity | undefined) => Promise<any>
) {
  console.debug(`tryDuplicateFileForSameSizes: ${key}`);

  // 1. download
  const remoteContent = await fsRemote.readFile(key);

  // 2. compare
  const localContent = await fsLocal.readFile(key);
  const eq = arraysAreEqual(localContent, remoteContent);

  if (eq) {
    // 3. if the same, update local but not upload
    // read meta of remote, as if we have downloaded the file
    console.debug(`tryDuplicateFileForSameSizes: ${key} content equal`);
    const entityRemote = await fsRemote.stat(key);

    // write
    const downloadResultEntity = await fsLocal.writeFile(
      key,
      remoteContent,
      entityRemote.mtimeCli ?? Date.now(),
      entityRemote.mtimeCli ?? Date.now()
    );
    await downloadCallback(downloadResultEntity);

    // no uploadCallback here
  } else {
    // 4. if not the same, rename local and save remote
    console.debug(`tryDuplicateFileForSameSizes: ${key} content not equal`);

    await fsLocal.rename(key, key2);

    const entityRemote = await fsRemote.stat(key);
    const downloadResultEntity = await fsLocal.writeFile(
      key,
      remoteContent,
      entityRemote.mtimeCli ?? Date.now(),
      entityRemote.mtimeCli ?? Date.now()
    );
    await downloadCallback(downloadResultEntity);

    const entityLocal = await fsLocal.stat(key2); // key2 here!
    const uploadResultEntity = await fsRemote.writeFile(
      key2, // key2 here!
      localContent,
      entityLocal.mtimeCli ?? Date.now(),
      entityLocal.mtimeCli ?? Date.now()
    );
    await uploadCallback(uploadResultEntity);
  }
}

/**
 * local: x.md -> x.dup.md -> upload to remote
 * remote: x.md -> download to local -> using original name x.md
 */
async function tryDuplicateFileForDiffSizes(
  key: string,
  key2: string,
  fsLocal: FakeFs,
  fsRemote: FakeFs,
  uploadCallback: (entity: Entity | undefined) => Promise<any>,
  downloadCallback: (entity: Entity | undefined) => Promise<any>
) {
  console.debug(`tryDuplicateFileForDiffSizes: ${key}`);

  await fsLocal.rename(key, key2);

  /**
   * x.dup.md -> upload to remote
   */
  async function f1() {
    const k = await copyFile(key2, fsLocal, fsRemote);
    await uploadCallback(k.entity);
    return k.entity;
  }

  /**
   * x.md -> download to local
   */
  async function f2() {
    const k = await copyFile(key, fsRemote, fsLocal);
    await downloadCallback(k.entity);
    return k.entity;
  }

  const [resUpload, resDownload] = await Promise.all([f1(), f2()]);

  return {
    upload: resUpload,
    download: resDownload,
  };
}

export async function tryDuplicateFile(
  key: string,
  fsLocal: FakeFs,
  fsRemote: FakeFs,
  uploadCallback: (entity: Entity | undefined) => Promise<any>,
  downloadCallback: (entity: Entity | undefined) => Promise<any>
) {
  let key2 = getFileRenameForDup(key);
  let usable = false;
  do {
    try {
      const s = await fsLocal.stat(key2);
      if (s === null || s === undefined) {
        throw Error(`not exist $${key2}`);
      }
      console.debug(`key2=${key2} exists, cannot use for new file`);
      key2 = getFileRenameForDup(key2);
      console.debug(`key2=${key2} is prepared for next try`);
    } catch (e) {
      // not exists, exactly what we want
      console.debug(`key2=${key2} doesn't exist, usable for new file`);
      usable = true;
    }
  } while (!usable);

  const localSize = await fsLocal.stat(key);
  const remoteSize = await fsRemote.stat(key);

  if (
    localSize !== undefined &&
    remoteSize !== undefined &&
    localSize.sizeRaw === remoteSize.sizeRaw
  ) {
    return await tryDuplicateFileForSameSizes(
      key,
      key2,
      fsLocal,
      fsRemote,
      uploadCallback,
      downloadCallback
    );
  } else {
    return await tryDuplicateFileForDiffSizes(
      key,
      key2,
      fsLocal,
      fsRemote,
      uploadCallback,
      downloadCallback
    );
  }
}
