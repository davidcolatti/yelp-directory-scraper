const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");

const extractLinks = async (page) => {
  const html = await page.content();
  const $ = cheerio.load(html);
  let results = [];

  let numberOfLinks = $("div > div > h4 > span > a").length;

  for (let i = 0; i < numberOfLinks; i++) {
    let businessName = $("div > div > h4 > span > a")[i].attribs.name;
    let anchorTag = $("div > div > h4 > span > a")[i].attribs.href;

    let data = {
      businessName: businessName || "N/A",
      link: `https://www.yelp.com${anchorTag}` || "N/A",
    };

    results.push(data);
  }

  return results;
};

const scrapeLink = async (page, data, writeStream) => {
  const html = await page.content();
  const $ = cheerio.load(html);

  await page.waitFor(3000);

  let phoneNumber = $(
    "div.lemon--div__373c0__1mboc.arrange-unit__373c0__o3tjT.arrange-unit-fill__373c0__3Sfw1.border-color--default__373c0__3-ifU > p:nth-child(2)"
  )
    .text()
    .replace(/.*(\(.*)/g, "$1");

  let category = $(
    "div.lemon--div__373c0__1mboc.margin-b3__373c0__q1DuY.border-color--default__373c0__3-ifU > div > div > span"
  ).text();

  let premium = data.link.includes("redirect_url");

  let newData = {
    sponsored: premium.toString(),
    businessName: data.businessName,
    link: page.url(),
    phoneNumber: phoneNumber || "N/A",
    category: category || "N/A",
  };

  console.log(newData);

  writeStream.write(
    `${newData.businessName} ~ ${newData.phoneNumber} ~ ${newData.category} ~ ${newData.sponsored} ~ ${newData.link} \n`
  );
  return newData;
};

const scrape = async (link) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.goto(link);

  const html = await page.content();
  const $ = cheerio.load(html);

  let lastPageNumber = $(".text-align--center__373c0__2n2yQ > span")
    .text()
    .split("of")[1]
    .trim();

  const rawDate = new Date().toString().split(" ");
  const type = link.split("loc=")[1].split("%2C")[0];
  const date = `${rawDate[1]}-${rawDate[2]}-${rawDate[3]}`;
  const writeStream = fs.createWriteStream(`Yelp-${date}-${type}.txt`);
  const pathName = writeStream.path;

  let data = [];
  for (let i = 0; i < lastPageNumber; i++) {
    console.log(`page ${i + 1}/${lastPageNumber}`);

    await page.waitFor(3000);

    let results = await extractLinks(page);
    data.push(...results);

    if (i != lastPageNumber - 1) {
      await page.click(
        "#wrap > div:nth-child(4) > div.lemon--div__373c0__1mboc.spinnerContainer__373c0__dHYYg.border-color--default__373c0__3-ifU.background-color--white__373c0__2uyKj > div > div.lemon--div__373c0__1mboc.leftRailContainer__373c0__390Ky.border-color--default__373c0__3-ifU > div.lemon--div__373c0__1mboc.leftRailMainContent__373c0__4Lx_e.padding-r5__373c0__126QE.padding-b5__373c0__3XORh.padding-l5__373c0__2Dc5X.border-color--default__373c0__3-ifU > div.lemon--div__373c0__1mboc.leftRailSearchResultsContainer__373c0__GUx8Y.border-color--default__373c0__3-ifU > div:nth-child(2) > div.lemon--div__373c0__1mboc.pagination__373c0__2FmRk.border--top__373c0__3gXLy.border--bottom__373c0__3qNtD.border-color--default__373c0__3-ifU > div:nth-child(1) > div > div:nth-child(11) > span > a"
      );
    }

    continue;
  }

  for (let j = 0; j < data.length; j++) {
    console.log(`scraping link ${j + 1}/${data.length}`);

    await page.goto(data[j].link);

    await scrapeLink(page, data[j], writeStream);

    continue;
  }

  await browser.close();
  await writeStream.end();
};

scrape(
  "https://www.yelp.com/search?find_desc=Home%20Improvement&find_loc=Dallas%2C%20TX"
);
// "https://www.yelp.com/search?find_desc=Home%20Improvement&find_loc=Boca%20Raton%2C%20FL"
