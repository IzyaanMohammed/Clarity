import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));
    page.on('console', msg => console.log('CONSOLE:', msg.text()));

    try {
        await page.goto('http://localhost:5173');
        await page.evaluate(() => {
            localStorage.setItem('ncertai_token', 'mock_token');
            localStorage.setItem('ncertai_user', JSON.stringify({id: 'mock', name: 'Mock User', class: '10', subjects: []}));
        });
        await page.goto('http://localhost:5173/exam-simulator', { waitUntil: 'networkidle0' });
    } catch(e) {
        console.log('CATCH ERROR:', e);
    }
    
    await browser.close();
    process.exit(0);
})();
