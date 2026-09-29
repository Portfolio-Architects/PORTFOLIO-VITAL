#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
개인정보 보호법 준거 로컬 개인정보 탐지 및 비식별화(마스킹) CLI 유틸리티
- 지원 형식: 텍스트(.txt), 마크다운(.md), JSON(.json), CSV(.csv), 한글문서(.hwpx)
- 탐지 대상: 주민등록번호, 외국인등록번호, 전화번호, 계좌번호, 카드번호, 운전면허/여권번호, 이메일, 민감정보 키워드
"""

import os
import sys
import re
import json
import zipfile
import argparse
from typing import List, Dict, Tuple, Any

# 윈도우 콘솔 및 다양한 터미널 환경을 위한 UTF-8 인코딩 보장
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 정밀 개인정보 패턴 및 표준 마스킹 치환 규칙
PATTERNS = [
    {
        "type": "주민등록번호(RRN)",
        "regex": re.compile(r"\b(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))[- ]?([1-4]\d{6})\b"),
        "replace": r"\1-*******",
        "severity": "CRITICAL",
        "legal_basis": "개인정보 보호법 제24조 (고유식별정보의 처리 제한)"
    },
    {
        "type": "외국인등록번호(FRN)",
        "regex": re.compile(r"\b(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))[- ]?([5-8]\d{6})\b"),
        "replace": r"\1-*******",
        "severity": "CRITICAL",
        "legal_basis": "개인정보 보호법 제24조 (고유식별정보의 처리 제한)"
    },
    {
        "type": "휴대전화번호(MOBILE)",
        "regex": re.compile(r"\b(01[016789])[- ]?(\d{3,4})[- ]?(\d{4})\b"),
        "replace": r"\1-****-\3",
        "severity": "HIGH",
        "legal_basis": "개인정보 보호법 제15조 (개인정보의 수집·이용)"
    },
    {
        "type": "일반전화번호(TEL)",
        "regex": re.compile(r"\b(02|0[3-6]\d)[- ]?(\d{3,4})[- ]?(\d{4})\b"),
        "replace": r"\1-***-\3",
        "severity": "MEDIUM",
        "legal_basis": "개인정보 보호법 제15조 (개인정보의 수집·이용)"
    },
    {
        "type": "신용/체크카드번호(CARD)",
        "regex": re.compile(r"\b(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})\b"),
        "replace": r"\1-****-****-\4",
        "severity": "CRITICAL",
        "legal_basis": "여신전문금융업법 및 개인정보 보호법 제24조"
    },
    {
        "type": "이메일주소(EMAIL)",
        "regex": re.compile(r"\b([a-zA-Z0-9_.+-]{1,3})[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b"),
        "replace": r"\1***@\2",
        "severity": "MEDIUM",
        "legal_basis": "개인정보 보호법 제15조"
    },
    {
        "type": "운전면허번호(DLN)",
        "regex": re.compile(r"\b(\d{2})[- ]?(\d{2})[- ]?(\d{6})[- ]?(\d{2})\b"),
        "replace": r"\1-**-******-\4",
        "severity": "HIGH",
        "legal_basis": "개인정보 보호법 제24조"
    },
    {
        "type": "여권번호(PASSPORT)",
        "regex": re.compile(r"\b([MSOGD]\d{2})\d{5}([0-9A-Z])\b"),
        "replace": r"\1*****\2",
        "severity": "HIGH",
        "legal_basis": "개인정보 보호법 제24조"
    },
    {
        "type": "은행계좌번호(ACCOUNT)",
        "regex": re.compile(r"\b(\d{3,6})[- ]?(\d{2,6})[- ]?(\d{3,8})\b"),
        "replace": r"\1-****-\3",
        "severity": "HIGH",
        "legal_basis": "개인정보 보호법 제15조"
    }
]

# 민감정보(건강, 장애, 의료, 복지 등) 키워드 사전
SENSITIVE_KEYWORDS = [
    "장애등급", "중증장애", "기초생활수급자", "차상위계층", "건강검진결과", 
    "진료기록", "질병명", "복용약물", "신체질환", "환자명단", "우울증", "치매"
]

def scan_text(content: str) -> List[Dict[str, Any]]:
    """텍스트 내 개인정보 탐지 및 상세 결과 리스트 반환"""
    findings = []
    lines = content.splitlines()

    for line_idx, line in enumerate(lines, start=1):
        # 1. 정규식 패턴 검사
        for p in PATTERNS:
            for match in p["regex"].finditer(line):
                val = match.group(0)
                # 계좌번호 패턴 오탐 필터링 (연도-월-일 또는 단순 숫자 나열 제외)
                if p["type"] == "은행계좌번호(ACCOUNT)":
                    if re.match(r"^(19|20)\d{2}[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])$", val):
                        continue
                    if len(val.replace("-", "").replace(" ", "")) < 10:
                        continue

                findings.append({
                    "line": line_idx,
                    "type": p["type"],
                    "severity": p["severity"],
                    "matched": val,
                    "legal_basis": p["legal_basis"],
                    "context": line.strip()
                })

        # 2. 민감정보 키워드 검사
        for kw in SENSITIVE_KEYWORDS:
            if kw in line:
                findings.append({
                    "line": line_idx,
                    "type": "민감정보키워드(SENSITIVE)",
                    "severity": "HIGH",
                    "matched": kw,
                    "legal_basis": "개인정보 보호법 제23조 (민감정보의 처리 제한)",
                    "context": line.strip()
                })

    return findings

def sanitize_text(content: str) -> Tuple[str, int]:
    """텍스트 내 개인정보를 안전한 마스킹 텍스트로 치환"""
    sanitized = content
    replacement_count = 0

    for p in PATTERNS:
        def _sub_func(match):
            nonlocal replacement_count
            val = match.group(0)
            if p["type"] == "은행계좌번호(ACCOUNT)":
                if re.match(r"^(19|20)\d{2}[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])$", val):
                    return val
                if len(val.replace("-", "").replace(" ", "")) < 10:
                    return val
            replacement_count += 1
            return p["regex"].sub(p["replace"], val)

        sanitized = p["regex"].sub(_sub_func, sanitized)

    return sanitized, replacement_count

def process_hwpx(filepath: str, output_path: str = None, mode: str = "scan") -> Tuple[List[Dict[str, Any]], int]:
    """한글 문서(.hwpx) 압축 내 Section XML 텍스트 스캔 및 마스킹 처리"""
    findings = []
    total_replacements = 0

    if not zipfile.is_zipfile(filepath):
        print(f"[ERROR] 올바른 HWPX(ZIP 포맷) 파일이 아닙니다: {filepath}")
        return [], 0

    with zipfile.ZipFile(filepath, 'r') as zin:
        xml_targets = [f for f in zin.namelist() if f.startswith("Contents/section") and f.endswith(".xml")]
        
        if mode == "scan":
            for target in xml_targets:
                xml_data = zin.read(target).decode('utf-8', errors='ignore')
                # 태그 제거한 순수 텍스트 추출
                text_clean = re.sub(r"<[^>]+>", " ", xml_data)
                f_list = scan_text(text_clean)
                for f in f_list:
                    f["section"] = target
                findings.extend(f_list)
            return findings, 0

        elif mode == "sanitize":
            if not output_path:
                print("[ERROR] HWPX 마스킹 출력을 위한 대상 경로(--output)가 필요합니다.")
                return [], 0

            with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    data = zin.read(item.filename)
                    if item.filename in xml_targets:
                        text_data = data.decode('utf-8', errors='ignore')
                        # XML 태그 내부 속성은 보호하고 태그 사이 텍스트만 치환
                        def _replace_in_tags(match):
                            prefix, text, suffix = match.groups()
                            san_t, count = sanitize_text(text)
                            nonlocal total_replacements
                            total_replacements += count
                            return f"{prefix}{san_t}{suffix}"

                        # <hp:t>텍스트</hp:t> 구조 치환
                        text_data = re.sub(r"(<hp:t[^>]*>)(.*?)(</hp:t>)", _replace_in_tags, text_data, flags=re.DOTALL)
                        zout.writestr(item, text_data.encode('utf-8'))
                    else:
                        zout.writestr(item, data)

            return [], total_replacements

    return findings, total_replacements

def main():
    parser = argparse.ArgumentParser(description="개인정보 보호법 준거 로컬 개인정보 탐지 및 비식별화 CLI 도구")
    parser.add_argument("--scan", type=str, help="개인정보 포함 여부를 정밀 스캔할 파일 경로")
    parser.add_argument("--sanitize", type=str, help="개인정보 마스킹 복제본을 생성할 원본 파일 경로")
    parser.add_argument("--output", type=str, help="마스킹 처리된 결과 파일 저장 경로")
    parser.add_argument("--text", type=str, help="단일 텍스트 문자열 직접 검사")

    args = parser.parse_args()

    if args.text:
        findings = scan_text(args.text)
        sanitized, count = sanitize_text(args.text)
        print(f"[스캔] 텍스트 인라인 스캔 결과: 총 {len(findings)}건 탐지")
        for idx, f in enumerate(findings, 1):
            print(f"  {idx}. [{f['severity']}] {f['type']} - 탐지어: {f['matched']}")
        print("\n[비식별화] 마스킹 처리 결과:")
        print(sanitized)
        return

    target_file = args.scan or args.sanitize
    if not target_file:
        parser.print_help()
        sys.exit(1)

    if not os.path.exists(target_file):
        print(f"[ERROR] 지정된 파일이 존재하지 않습니다: {target_file}")
        sys.exit(1)

    is_hwpx = target_file.lower().endswith(".hwpx")

    if args.scan:
        print(f"[개인정보 정밀 스캔 가동] 대상 파일: {target_file}")
        if is_hwpx:
            findings, _ = process_hwpx(target_file, mode="scan")
        else:
            with open(target_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            findings = scan_text(content)

        print(f">> 탐지 결과 요약: 총 {len(findings)}건의 개인정보/민감정보 검출됨\n")
        if not findings:
            print("  [OK] 개인정보 패턴 및 민감정보 키워드가 검출되지 않았습니다. 안심하고 AI 대화에 참조 가능합니다.")
            return

        print("| 순번 | 심각도 | 유형 | 라인 | 탐지 내용(일부) | 법적 근거 |")
        print("|:---:|:---:|:---|:---:|:---|:---|")
        for idx, f in enumerate(findings, 1):
            masked_snippet = f["matched"][:3] + "*" * (len(f["matched"]) - 3) if len(f["matched"]) > 3 else "***"
            print(f"| {idx} | {f['severity']} | {f['type']} | {f.get('line', '-')} | `{masked_snippet}` | {f['legal_basis']} |")

        print("\n* [권고 사항]: 상기 파일은 원본 상태로 AI 대화창에 첨부하지 마시고, `--sanitize` 옵션을 통해 비식별화 사본을 생성하여 활용하십시오.")

    elif args.sanitize:
        output_file = args.output
        if not output_file:
            base, ext = os.path.splitext(target_file)
            output_file = f"{base}_sanitized{ext}"

        print(f"[개인정보 비식별화(마스킹) 처리 가동]")
        print(f">> 원본 파일: {target_file}")
        print(f">> 출력 파일: {output_file}")

        if is_hwpx:
            _, count = process_hwpx(target_file, output_path=output_file, mode="sanitize")
        else:
            with open(target_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            sanitized, count = sanitize_text(content)
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(sanitized)

        print(f"  [OK] 비식별화 완료: 총 {count}건의 식별자 마스킹 적용 완료.")
        print(f"  [OK] 저장 완료: {output_file}")
        print("  * 원본 문서는 변조 없이 안전하게 보존되었습니다.")

if __name__ == "__main__":
    main()
