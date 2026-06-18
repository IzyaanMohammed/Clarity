import puppeteer from 'puppeteer';
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    page.on('console', msg => console.log('CONSOLE:', msg.text()));
    try {
        await page.goto('http://localhost:5173/exam-simulator', { waitUntil: 'networkidle0' });
    } catch(e) {
        console.log(e);
    }
    await browser.close();
})();
