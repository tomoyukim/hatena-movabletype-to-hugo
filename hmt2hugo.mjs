#!/usr/bin/env zx

const downloadImage = async (image_url, download_dir) => {
  const filename = image_url.substring(image_url.lastIndexOf('/'));
  try {
    const response = await fetch(image_url);
    const savePath = `${download_dir}/${filename}`;
    response.body.pipe(fs.createWriteStream(savePath));
  } catch (error) {
    console.error(error);
  }
  return filename;
};

const replaceHost = (src) => {
  if (argv.f && argv.t) {
    const old_host = argv.f;
    const new_host = argv.t;
    const pattern = new RegExp(old_host, 'g');
    return src.replaceAll(pattern, new_host);
  }
  return src;
};

const resolveHTMLEscapeSequence = (text) => {
  const gt = /&gt;/g;
  const lt = /&lt;/g;
  const quot = /&quot;|&#39;/g;
  const doublequot = /&#34;/g;
  const amp = /&amp;/g;

  // replace escape sequence
  let body = text.replaceAll(gt, '>');
  body = body.replaceAll(lt, '<');
  body = body.replaceAll(quot, '\'');
  body = body.replaceAll(doublequot, '"');
  body = body.replaceAll(amp, '&');

  return body;
};

const simplifyHTMLBody = (body_src) => {
  const keyword = /<a class="keyword"[^>]*>([^<]+)<\/a>/g;
  const amazon_link = /<div class="hatena-asin-detail">.*<p class="hatena-asin-detail-title"><a href=".+\/ASIN\/(.+)\/.+\/">([^<>]+)<\/a><\/p>.+<div class="hatena-asin-detail-foot"><\/div><\/div>/g;
  const photo_link = /<span itemscope itemtype="http:\/\/schema\.org\/Photograph"><img src="(.+\.[a-z]*)"[^>]*><\/span>/g;
  const blogspot_image_link = /<div class="separator".*<img.+src="(.+blogspot.+\.[a-z]+)"[^>]*>.*<\/div>/g;
  const card_link = /<iframe src="[^"]*" title="([^"]*)"[^>]*>.*<\/iframe><cite[^>]*><a href="([^"]*)">.*<\/cite>/g;
  const card_link2 = /<iframe src="(?:http:)*\/\/hatenablog(?:-parts)*\.com\/embed\?url=([^"]*)" title="([^"]*)"[^>]*>.*<\/iframe>/g;
  const card_link3 = /<iframe src="([^"]*)" title="([^"]*)"[^>]*>.*<\/iframe>/g; // e.g. self link
  const image_link = /<a href="(.+)"[^>]*><img src="(.+)"[^>]*alt="(.+)"[^>]*><\/a>/g;
  const a = /<a href="([\S]+)"[^>]*>(.+)<\/a>/g;

  const vimeo = /<iframe src=".+vimeo\.com\/video\/([0-9]+)[^>]*><\/iframe>/g;
  const youtube_api = /<iframe.*src="https:\/\/youtube.*\/v\/([^"]*)&[^>]+><\/iframe>/g;

  const p = /<\/?p>/g;
  const code = /<\/?code>/g;
  const snippet = /<pre class="code.*" data-lang="(.*)" data-unlink[^>]*>/g;
  const pre = /<\/pre>|<pre class="code" data-unlink>/g;
  const span = /<\/?span[ \w+="]*>/g;
  const ul = /<\/?ul>/g;
  const li = /<li>(.+)<\/li>/g;


  const image_urls = [];

  // remove hatena keyword
  let body = body_src.replaceAll(keyword, (_, word) => {
    return word;
  });

  ///!! The order is important
  // replace amazon link with custom shortcode
  body = body.replaceAll(amazon_link, (_, asin, title) => {
    return `{{< amazon asin="${asin}" >}}
${title}
{{< /amazon >}}`;
  });

  // replace photo link with figure shortcode
  body = body.replaceAll(photo_link, (_, url) => {
    image_urls.push(url);
    const filename = url.substring(url.lastIndexOf('/'));
    return `{{< figure src="image${filename}" >}}`;
  });
  body = body.replaceAll(blogspot_image_link, (_, url) => {
    image_urls.push(url);
    const filename = url.substring(url.lastIndexOf('/'));
    return `{{< figure src="image${filename}" >}}`;
  });

  // replace card link with custom shortcode
  body = body.replaceAll(card_link, (_, title, url) => {
    return `{{% card "${url}" %}}${title}{{% /card %}}`;
  });
  body = body.replaceAll(card_link2, (_, url, title) => {
    return `{{% card "${decodeURIComponent(url)}" %}}${title}{{% /card %}}`;
  });
  body = body.replaceAll(card_link3, (_, url, title) => {
    return `{{% card "${url}" %}}${title}{{% /card %}}`;
  });
  // replace image link with figure shortcode
  body = body.replaceAll(image_link, (_, href, src, alt) => {
    return `{{< figure src="${src}" link="${href}" alt="${alt}" target="_blank" >}}`;
  });

  // replace normal link
  body = body.replaceAll(a, (_, url, title) => {
    return `[${title}](${url})`;
  });

  // replace youtube api iframe
  body = body.replaceAll(youtube_api, (_, id) => {
    return `{{< youtube ${id} >}}`;
  });

  // replace vimeo tag
  body = body.replaceAll(vimeo, (_, id) => {
    return `{{< vimeo ${id} >}}`;
  });

  // replace list
  body = body.replaceAll(ul, ''); // remove <ul></ul>
  body = body.replaceAll(li, (_, item) => {
    return `* ${item}`;
  });

  // replace <code></code>
  body = body.replaceAll(code, '`');

  // replace code snippet
  body = body.replaceAll(snippet, (_, lang) => {
    return '\n```' + lang + '\n';
  });
  body = body.replaceAll(pre, '\n```\n');
  // remove <span>
  body = body.replaceAll(span, '');

  // remove <p></p>
  body = body.replaceAll(p, '');

  body = resolveHTMLEscapeSequence(body);

  return {
    body,
    image_urls
  };
};

const resolveTargetDir = (argv_o, path) => {
  if (argv_o.endsWith('/')) {
    return argv.o + path;
  } else {
    return `${argv.o}/${path}`;
  }
};

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = ('00' + (date.getMonth()+1)).slice(-2);
  const d = ('00' + date.getDate()).slice(-2);
  return (y + '-' + m + '-' + d);
}

const parseMeta = (str) => {
  const items = str.split('\n');
  const front_matter = {};
  const categories = [];
  let path = null;

  for (const item of items) {
    // note: split() is not appropriate because colon can be used in the value. e.g. time format 00:01:23
    const delimiter = item.indexOf(':');
    const prop = item.substring(0, delimiter);
    const val = item.substring(delimiter + 1);

    switch (prop) {
    case 'AUTHOR':
      front_matter['author'] = val.trim();
      break;
    case 'TITLE':
      front_matter['title'] = resolveHTMLEscapeSequence(val.trim());
      break;
    case 'BASENAME':
      path = val.trim();
      break;
    case 'STATUS':
      front_matter['draft'] = val.includes('Publish') ? 'false' : 'true';
      break;
    case 'DATE':
      const date = new Date(val.trim());
      front_matter['date'] = formatDate(date);
      break;
    case 'CATEGORY':
      categories.push(val.trim())
      break;
    case 'IMAGE':
      front_matter['image'] = val.trim();
    default:
      break;
    }
  }

  if (categories.length > 0) {
    front_matter['categories'] = categories;
  }

  return {
    path,
    front_matter
  };
};

// main
if (argv['_'].length === 1) {
  fs.readFile(argv['_'][0], "utf-8", async (err, data) => {
    if (err) throw err;

    const articles = data.split('--------');
    for (const article of articles) {
      const [row_meta, row_body] = article.split('-----');

      const meta = row_meta.trim();
      if (meta.length > 0) {
	const { path, front_matter } = parseMeta(meta);

	const target_dir = argv.o ? resolveTargetDir(argv.o, path) : path;
	await $`mkdir -p ${target_dir}`;

	if (front_matter.img) {
	  const image_name = await downloadImage(front_matter.img, target_dir);
	  front_matter.img = image_name;
	}

	if (!row_body) {
	  break;
	}
	const body = row_body.substring(row_body.indexOf('BODY:')+5).trim(); // remove BODY:

	const preprocessed = replaceHost(body, );
	const content = simplifyHTMLBody(preprocessed);
	for (const image_url of content.image_urls) {
	  await $`mkdir -p ${target_dir}/image`;
	  await downloadImage(image_url, `${target_dir}/image`);
	}

	const post = `${JSON.stringify(front_matter)}
${content.body}`;

	fs.writeFile(`${target_dir}/index.md`, post, (err, date) => {
	  if (err) throw err;
	});
      }
    }
  });

}

console.log('Usage: hmt2hugo [-o OUTPUT_DIR] [-f ORIGINAL_BASE_URL] [-t NEW_BASE_URL] HATENA_EXPORT_FILE')
