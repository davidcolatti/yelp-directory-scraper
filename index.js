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

const scrape = (links) => {
  links.forEach(async (link) => {
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
        await page.waitForSelector(
          ".lemon--div__373c0__1mboc > .lemon--div__373c0__1mboc:nth-child(11) > .lemon--span__373c0__3997G > .lemon--a__373c0__IEZFH > .lemon--span__373c0__3997G"
        );
        await page.click(
          ".lemon--div__373c0__1mboc > .lemon--div__373c0__1mboc:nth-child(11) > .lemon--span__373c0__3997G > .lemon--a__373c0__IEZFH > .lemon--span__373c0__3997G"
        );
      }

      continue;
    }

    for (let j = 0; j < data.length; j++) {
      console.log(`scraping link ${j + 1}/${data.length}`);

      try {
        await page.goto(data[j].link);

        await scrapeLink(page, data[j], writeStream);
      } catch (e) {
        console.log(`couldn't scrape ${data[j].link}`);
      }

      continue;
    }

    await browser.close();
    await writeStream.end();
    console.log(`Done scraping ${type}`);
  });
};

scrape([
  "https://www.yelp.com/search?find_desc=Home+Improvement&find_loc=Houston%2C+TX&ns=1",
  "https://www.yelp.com/search?find_desc=Home%20Improvement&find_loc=Austin%2C%20TX",
  "https://www.yelp.com/search?find_desc=Home+Improvement&find_loc=Atlanta%2C+GA&ns=1",
  "https://www.yelp.com/search?find_desc=Home%20Improvement&find_loc=Chattanooga%2C%20GA",
  "https://www.yelp.com/search?find_desc=Home%20Improvement&find_loc=Charlotte%2C%20NC",
]);
