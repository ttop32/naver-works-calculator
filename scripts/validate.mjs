#!/usr/bin/env node
// 유저스크립트 검증: 문법 + 메타데이터 블록 + (선택) 버전 상승 여부
//
//   node scripts/validate.mjs                 문법 / 메타데이터만 검사
//   node scripts/validate.mjs --prev 0.0.18   위 검사 + 0.0.18 보다 높은지 확인

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'naver-works-calculator.user.js');
const REQUIRED_KEYS = ['@name', '@namespace', '@version', '@description', '@match', '@grant', '@license'];

const src = readFileSync(FILE, 'utf8');
const errors = [];

// 1. 메타데이터 블록
const meta = src.match(/\/\/ ==UserScript==\r?\n([\s\S]*?)\/\/ ==\/UserScript==/);
if (!meta) {
    errors.push('==UserScript== 메타데이터 블록이 없습니다.');
} else {
    if (src.indexOf('// ==UserScript==') !== 0) {
        errors.push('메타데이터 블록은 파일 맨 첫 줄에서 시작해야 합니다.');
    }
    for (const key of REQUIRED_KEYS) {
        if (!new RegExp(`^//\\s*${key}\\s+\\S`, 'm').test(meta[1])) {
            errors.push(`필수 메타데이터 누락: ${key}`);
        }
    }
}

// 2. 버전 형식
const versionMatch = src.match(/^\/\/\s*@version\s+(\d+\.\d+\.\d+)\s*$/m);
if (!versionMatch) {
    errors.push('@version 이 x.y.z 형식이 아닙니다.');
}
const version = versionMatch?.[1];

// 3. 문법
try {
    new vm.Script(src, { filename: 'naver-works-calculator.user.js' });
} catch (e) {
    errors.push(`문법 오류: ${e.message}`);
}

// 4. 버전 상승 (--prev 가 주어졌을 때만)
const prevIdx = process.argv.indexOf('--prev');
if (prevIdx !== -1 && version) {
    const prev = process.argv[prevIdx + 1];
    if (prev && /^\d+\.\d+\.\d+$/.test(prev) && compare(version, prev) <= 0) {
        errors.push(
            `@version 이 올라가지 않았습니다 (이전 ${prev} / 현재 ${version}). ` +
            'Greasy Fork 는 버전이 올라간 경우에만 새 버전으로 배포합니다. ' +
            '`npm run bump` 을 실행하세요.'
        );
    }
}

if (errors.length) {
    for (const err of errors) console.error(`✗ ${err}`);
    process.exit(1);
}

console.log(`✓ naver-works-calculator.user.js v${version} 검증 통과`);

function compare(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}
