from playwright.sync_api import sync_playwright
import time

url = "https://upstage.notion.site/MABC-2026-3d1e45d0002580a49c3dfb6e81ec41cc"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(5)
    
    # 스크롤하며 추가 콘텐츠 로딩
    for i in range(8):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)
    
    content = page.evaluate("""() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const texts = [];
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text && text.length > 2) {
                texts.push(text);
            }
        }
        return texts.join('\\n');
    }""")
    
    print("=== 제목 ===")
    print(page.title())
    print()
    print("=== 콘텐츠 ===")
    print(content[:20000])
    
    browser.close()
