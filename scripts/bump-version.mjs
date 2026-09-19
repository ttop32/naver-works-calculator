#!/usr/bin/env node
// @version 을 올린다.  사용법: node scripts/bump-version.mjs [patch|minor|major|<x.y.z>]
// Greasy Fork 는 @version 이 올라간 경우에만 새 버전으로 취급하므로,
// 커밋 전에 반드시 한 번 실행해야 한다.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'naver-works-calculator.user.js');

const VERSION_LINE = /^(\/\/\s*@version\s+)(\d+\.\d+\.\d+)\s*$/m;

const arg = process.argv[2] ?? 'patch';

const src = readFileSync(FILE, 'utf8');
const match = src.match(VERSION_LINE);
if (!match) {
    console.error('[bump] @version 줄을 찾지 못했습니다.');
    process.exit(1);
}

const current = match[2];
let next;

if (/^\d+\.\d+\.\d+$/.test(arg)) {
    next = arg;
} else {
    const [major, minor, patch] = current.split('.').map(Number);
    if (arg === 'major') next = `${major + 1}.0.0`;
    else if (arg === 'minor') next = `${major}.${minor + 1}.0`;
    else if (arg === 'patch') next = `${major}.${minor}.${patch + 1}`;
    else {
        console.error(`[bump] 알 수 없는 인자: ${arg} (patch|minor|major|x.y.z)`);
        process.exit(1);
    }
}

if (compare(next, current) <= 0) {
    console.error(`[bump] 새 버전(${next})이 현재 버전(${current})보다 높지 않습니다.`);
    process.exit(1);
}

writeFileSync(FILE, src.replace(VERSION_LINE, `$1${next}`), 'utf8');
console.log(`[bump] ${current} -> ${next}`);

function compare(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}
