import type { EmailBlock, SocialLink } from '@/lib/supabase/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SectionTemplate {
  id: string
  name: string
  description?: string
  blocks: EmailBlock[]
}

export interface SectionCategory {
  id: string
  label: string
  sections: SectionTemplate[]
}

// ─── Placeholder images (picsum stable IDs) ────────────────────────────────────

const IMG_LANDSCAPE  = 'https://picsum.photos/id/1043/600/320'
const IMG_LANDSCAPE2 = 'https://picsum.photos/id/1036/600/320'
const IMG_DARK       = 'https://picsum.photos/id/1022/600/360'
const IMG_DARK2      = 'https://picsum.photos/id/1058/600/360'
const IMG_SQ1        = 'https://picsum.photos/id/1043/300/240'
const IMG_SQ2        = 'https://picsum.photos/id/119/300/240'
const IMG_SQ3        = 'https://picsum.photos/id/137/300/240'
const IMG_SMALL      = 'https://picsum.photos/id/1082/160/160'
const IMG_AVATAR     = 'https://picsum.photos/id/64/80/80'

// ─── Helper: create a block with a static template ID ─────────────────────────
// IDs are replaced with generateId() when the section is added to the canvas.

function b(id: string, partial: Omit<EmailBlock, 'id'>): EmailBlock {
  return { id, ...partial } as EmailBlock
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 1 · Text & images
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_IMAGES: SectionCategory = {
  id: 'text_images',
  label: 'Text & images',
  sections: [

    // 1 · Hero (stacked)
    {
      id: 'ti-hero',
      name: 'Hero with image',
      description: 'Full-width image + title + text + CTA',
      blocks: [
        b('ti-h1', { type: 'image', imageUrl: IMG_LANDSCAPE, imageAlt: 'Hero', imageWidth: 100, alignment: 'center', paddingTop: 0, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
        b('ti-h2', { type: 'heading', headingTag: 'h2', headingText: 'Some title here', fontSize: 28, color: '#1B1B1B', alignment: 'center', paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0 }),
        b('ti-h3', { type: 'text', textContent: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.', fontSize: 15, color: '#555555', alignment: 'center', paddingTop: 0, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
        b('ti-h4', { type: 'button', buttonLabel: 'Call to action', buttonUrl: '#', buttonBgColor: '#1B1B1B', buttonTextColor: '#FFFFFF', buttonRadius: 4, alignment: 'center', paddingTop: 4, paddingBottom: 24, paddingLeft: 0, paddingRight: 0 }),
      ],
    },

    // 2 · Product feature (image left + text right)
    {
      id: 'ti-feature',
      name: 'Product feature',
      description: 'Image left · title, badge, price, CTA right',
      blocks: [
        b('ti-f1', {
          type: 'columns', columnCount: 2, columnGap: 24,
          paddingTop: 16, paddingBottom: 16, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'image', imageUrl: IMG_SQ1, imageAlt: 'Product', alignment: 'left' },
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:11px;color:#aaa;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">New!</p><p style="font-size:22px;font-weight:800;color:#1B1B1B;margin:0 0 4px;">Some title here</p><p style="font-size:14px;color:#777;margin:0 0 14px;">From 20€</p><p style="font-size:14px;color:#555;line-height:1.65;margin:0 0 18px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam.</p><a href="#" style="display:inline-block;background:#1B1B1B;color:#FFF;padding:11px 24px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:700;">Call to action</a>` },
          ],
        }),
      ],
    },

    // 3 · Product with old/new price
    {
      id: 'ti-product-price',
      name: 'Product with price',
      description: 'Thumbnail + heading + old/new price + CTA',
      blocks: [
        b('ti-p1', {
          type: 'columns', columnCount: 2, columnGap: 20,
          paddingTop: 16, paddingBottom: 16, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'image', imageUrl: IMG_SMALL, imageAlt: 'Product', alignment: 'center' },
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:19px;font-weight:800;color:#1B1B1B;margin:0 0 6px;">Some title here</p><p style="font-size:13px;color:#aaa;margin:0 0 14px;"><s>49,99€</s>&nbsp;&nbsp;<strong style="color:#1B1B1B;font-size:16px;">39,99€</strong></p><p style="font-size:13px;color:#666;line-height:1.6;margin:0 0 16px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore.</p><a href="#" style="display:inline-block;background:#1B1B1B;color:#FFF;padding:10px 22px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:700;">Call to action</a>` },
          ],
        }),
      ],
    },

    // 4 · 3-column products
    {
      id: 'ti-3col-products',
      name: '3-column products',
      description: '3 cards · image, title, text, CTA',
      blocks: [
        b('ti-3c1', {
          type: 'columns', columnCount: 3, columnGap: 16,
          paddingTop: 16, paddingBottom: 16, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', alignment: 'left', textContent: `<img src="${IMG_SQ1}" alt="Product 1" style="width:100%;border-radius:4px;display:block;margin-bottom:12px;"><strong style="font-size:15px;color:#1B1B1B;">Some title here</strong><br><br><span style="font-size:13px;color:#666;line-height:1.5;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</span><br><br><a href="#" style="display:inline-block;background:#1B1B1B;color:#FFF;padding:9px 18px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:700;">Call to action</a>` },
            { type: 'text', alignment: 'left', textContent: `<img src="${IMG_SQ2}" alt="Product 2" style="width:100%;border-radius:4px;display:block;margin-bottom:12px;"><strong style="font-size:15px;color:#1B1B1B;">Some title here</strong><br><br><span style="font-size:13px;color:#666;line-height:1.5;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</span><br><br><a href="#" style="display:inline-block;background:#1B1B1B;color:#FFF;padding:9px 18px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:700;">Call to action</a>` },
            { type: 'text', alignment: 'left', textContent: `<img src="${IMG_SQ3}" alt="Product 3" style="width:100%;border-radius:4px;display:block;margin-bottom:12px;"><strong style="font-size:15px;color:#1B1B1B;">Some title here</strong><br><br><span style="font-size:13px;color:#666;line-height:1.5;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</span><br><br><a href="#" style="display:inline-block;background:#1B1B1B;color:#FFF;padding:9px 18px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:700;">Call to action</a>` },
          ],
        }),
      ],
    },

    // 5 · Hero with centred overlay text
    {
      id: 'ti-hero-overlay',
      name: 'Hero overlay (centred)',
      description: 'Dark image with centred white text + CTA',
      blocks: [
        b('ti-o1', {
          type: 'html',
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          htmlContent: `<div style="position:relative;overflow:hidden;border-radius:8px;min-height:290px;background-image:url('${IMG_DARK}');background-size:cover;background-position:center;">
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.50);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px 32px;text-align:center;">
    <h2 style="color:#FFF;font-size:30px;font-weight:800;margin:0 0 14px;line-height:1.15;">Some title here</h2>
    <p style="color:rgba(255,255,255,0.82);font-size:15px;line-height:1.65;margin:0 0 26px;max-width:440px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.</p>
    <a href="#" style="display:inline-block;background:#FFF;color:#1B1B1B;padding:13px 30px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:800;">Call to action</a>
  </div>
</div>`,
        }),
      ],
    },

    // 6 · Hero with left-aligned overlay
    {
      id: 'ti-hero-dark-left',
      name: 'Hero overlay (left-aligned)',
      description: 'Dark image with left-aligned white text',
      blocks: [
        b('ti-dl1', {
          type: 'html',
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          htmlContent: `<div style="position:relative;overflow:hidden;border-radius:8px;min-height:250px;background-image:url('${IMG_DARK2}');background-size:cover;background-position:center;">
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;justify-content:center;padding:36px 36px;">
    <h2 style="color:#FFF;font-size:26px;font-weight:800;margin:0 0 10px;line-height:1.2;max-width:340px;">Some title here</h2>
    <p style="color:rgba(255,255,255,0.78);font-size:14px;line-height:1.65;margin:0 0 22px;max-width:320px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt.</p>
    <div><a href="#" style="display:inline-block;background:#FFF;color:#1B1B1B;padding:11px 26px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:800;">Call to action</a></div>
  </div>
</div>`,
        }),
      ],
    },

    // 7 · Author / article preview
    {
      id: 'ti-author',
      name: 'Author article',
      description: 'Round avatar left + author name + article text',
      blocks: [
        b('ti-a1', {
          type: 'columns', columnCount: 2, columnGap: 20,
          paddingTop: 16, paddingBottom: 16, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'image', imageUrl: IMG_AVATAR, imageAlt: 'Author', alignment: 'center' },
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:20px;font-weight:800;color:#1B1B1B;margin:0 0 3px;">Some title here</p><p style="font-size:12px;color:#999;margin:0 0 12px;">By Anna Smith</p><hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 12px;"><p style="font-size:14px;color:#555;line-height:1.65;margin:0;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore.</p>` },
          ],
        }),
      ],
    },

  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 2 · Text
// ─────────────────────────────────────────────────────────────────────────────

const TEXT: SectionCategory = {
  id: 'text',
  label: 'Text',
  sections: [

    // 1 · Product info
    {
      id: 'tx-product-info',
      name: 'Product info',
      description: 'Small label + large heading + paragraph',
      blocks: [
        b('tx-p1', { type: 'text', textContent: 'From 20€', fontSize: 13, color: '#999999', alignment: 'left', paddingTop: 12, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }),
        b('tx-p2', { type: 'heading', headingTag: 'h2', headingText: 'Some title here', fontSize: 26, color: '#1B1B1B', alignment: 'left', paddingTop: 4, paddingBottom: 8, paddingLeft: 0, paddingRight: 0 }),
        b('tx-p3', { type: 'text', textContent: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat. At vero eos et accusam et justo duo dolores et ea rebum.', fontSize: 15, color: '#555555', alignment: 'left', paddingTop: 0, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
      ],
    },

    // 2 · 2-column contrast text
    {
      id: 'tx-2col-contrast',
      name: '2-column contrast',
      description: 'White text column + dark background column',
      blocks: [
        b('tx-cc1', {
          type: 'columns', columnCount: 2, columnGap: 0,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', alignment: 'left', textContent: `<div style="padding:26px 20px;"><p style="font-size:20px;font-weight:800;color:#1B1B1B;margin:0 0 10px;">Some title here</p><p style="font-size:14px;color:#555;line-height:1.65;margin:0;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum.</p></div>` },
            { type: 'text', alignment: 'left', textContent: `<div style="background:#2D2D2D;padding:26px 20px;height:100%;"><p style="font-size:20px;font-weight:800;color:#FFFFFF;margin:0 0 10px;">Some title here</p><p style="font-size:14px;color:rgba(255,255,255,0.72);line-height:1.65;margin:0;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum.</p></div>` },
          ],
        }),
      ],
    },

    // 3 · Promo code
    {
      id: 'tx-promo-code',
      name: 'Promo code',
      description: 'Boxed discount code highlight',
      blocks: [
        b('tx-pc1', {
          type: 'html',
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          htmlContent: `<div style="background:#F3F3F3;border-radius:10px;padding:30px 24px;text-align:center;border:1px dashed #DDD;">
  <p style="font-size:15px;color:#666;margin:0 0 10px;line-height:1.5;">Save 15% on your next order!</p>
  <p style="font-size:34px;font-weight:900;color:#1B1B1B;letter-spacing:4px;margin:0;font-family:monospace;">PROMO15</p>
</div>`,
        }),
      ],
    },

    // 4 · Stats / metrics
    {
      id: 'tx-stats',
      name: 'Stats / metrics',
      description: '3 big numbers with labels',
      blocks: [
        b('tx-s1', {
          type: 'columns', columnCount: 3, columnGap: 12,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', alignment: 'center', textContent: `<div style="text-align:center;padding:18px 10px;background:#F5F5F5;border-radius:10px;"><p style="font-size:34px;font-weight:900;color:#1B1B1B;margin:0 0 4px;line-height:1;">4.8</p><p style="font-size:11px;color:#999;margin:0;text-transform:uppercase;letter-spacing:1px;">Average note</p></div>` },
            { type: 'text', alignment: 'center', textContent: `<div style="text-align:center;padding:18px 10px;background:#F5F5F5;border-radius:10px;"><p style="font-size:34px;font-weight:900;color:#1B1B1B;margin:0 0 4px;line-height:1;">120</p><p style="font-size:11px;color:#999;margin:0;text-transform:uppercase;letter-spacing:1px;">Reviews</p></div>` },
            { type: 'text', alignment: 'center', textContent: `<div style="text-align:center;padding:18px 10px;background:#F5F5F5;border-radius:10px;"><p style="font-size:34px;font-weight:900;color:#1B1B1B;margin:0 0 4px;line-height:1;">200K</p><p style="font-size:11px;color:#999;margin:0;text-transform:uppercase;letter-spacing:1px;">Downloads</p></div>` },
          ],
        }),
      ],
    },

    // 5 · Feature icons (3 col)
    {
      id: 'tx-features-icons',
      name: 'Feature icons',
      description: '3 columns with emoji icon + heading + text',
      blocks: [
        b('tx-fi1', {
          type: 'columns', columnCount: 3, columnGap: 16,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', alignment: 'center', textContent: `<div style="text-align:center;"><p style="font-size:30px;margin:0 0 10px;">♥</p><p style="font-size:15px;font-weight:700;color:#1B1B1B;margin:0 0 6px;">Some title here</p><p style="font-size:13px;color:#666;line-height:1.55;margin:0;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p></div>` },
            { type: 'text', alignment: 'center', textContent: `<div style="text-align:center;"><p style="font-size:30px;margin:0 0 10px;">🎁</p><p style="font-size:15px;font-weight:700;color:#1B1B1B;margin:0 0 6px;">Some title here</p><p style="font-size:13px;color:#666;line-height:1.55;margin:0;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p></div>` },
            { type: 'text', alignment: 'center', textContent: `<div style="text-align:center;"><p style="font-size:30px;margin:0 0 10px;">❓</p><p style="font-size:15px;font-weight:700;color:#1B1B1B;margin:0 0 6px;">Some title here</p><p style="font-size:13px;color:#666;line-height:1.55;margin:0;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p></div>` },
          ],
        }),
      ],
    },

    // 6 · Steps (2×2)
    {
      id: 'tx-steps',
      name: 'Steps (4-step)',
      description: '2×2 grid: Step 1–4 with divider lines',
      blocks: [
        b('tx-st1', {
          type: 'columns', columnCount: 2, columnGap: 28,
          paddingTop: 8, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:19px;font-weight:900;color:#1B1B1B;margin:0 0 6px;">Step 1.</p><p style="font-size:13px;color:#666;line-height:1.55;margin:0 0 14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p><hr style="border:none;border-top:1px solid #E5E7EB;margin:0;">` },
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:19px;font-weight:900;color:#1B1B1B;margin:0 0 6px;">Step 2.</p><p style="font-size:13px;color:#666;line-height:1.55;margin:0 0 14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p><hr style="border:none;border-top:1px solid #E5E7EB;margin:0;">` },
          ],
        }),
        b('tx-st2', {
          type: 'columns', columnCount: 2, columnGap: 28,
          paddingTop: 12, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:19px;font-weight:900;color:#1B1B1B;margin:0 0 6px;">Step 3.</p><p style="font-size:13px;color:#666;line-height:1.55;margin:0 0 14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p><hr style="border:none;border-top:1px solid #E5E7EB;margin:0;">` },
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:19px;font-weight:900;color:#1B1B1B;margin:0 0 6px;">Step 4.</p><p style="font-size:13px;color:#666;line-height:1.55;margin:0 0 14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p><hr style="border:none;border-top:1px solid #E5E7EB;margin:0;">` },
          ],
        }),
      ],
    },

    // 7 · Numbered list
    {
      id: 'tx-numbered-list',
      name: 'Numbered list',
      description: 'Ordered list with 4 items',
      blocks: [
        b('tx-nl1', {
          type: 'text', alignment: 'left',
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          textContent: `<ol style="list-style-type:decimal;padding-left:22px;margin:0;color:#555;">
  <li style="margin:0 0 14px;line-height:1.65;font-size:14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore. At vero eos et accusam.</li>
  <li style="margin:0 0 14px;line-height:1.65;font-size:14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore. At vero eos et accusam.</li>
  <li style="margin:0 0 14px;line-height:1.65;font-size:14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore. At vero eos et accusam.</li>
  <li style="margin:0;line-height:1.65;font-size:14px;">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore. At vero eos et accusam.</li>
</ol>`,
        }),
      ],
    },

    // 8 · CTA banner (dark bar)
    {
      id: 'tx-cta-bar',
      name: 'CTA banner',
      description: 'Dark full-width announcement bar',
      blocks: [
        b('tx-cb1', {
          type: 'html',
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          htmlContent: `<div style="background:#1B1B1B;border-radius:6px;padding:16px 24px;text-align:center;">
  <a href="#" style="color:#FFF;font-size:14px;font-weight:600;text-decoration:underline;">15% off on every products for the next 48 hours!</a>
</div>`,
        }),
      ],
    },

  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 3 · Images
// ─────────────────────────────────────────────────────────────────────────────

const IMAGES: SectionCategory = {
  id: 'images',
  label: 'Images',
  sections: [
    {
      id: 'img-full',
      name: 'Full-width image',
      description: 'Single full-width image',
      blocks: [
        b('img-f1', { type: 'image', imageUrl: IMG_LANDSCAPE, imageAlt: 'Image', imageWidth: 100, alignment: 'center', paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0 }),
      ],
    },
    {
      id: 'img-2col',
      name: '2-column images',
      description: 'Two images side by side',
      blocks: [
        b('img-2c1', {
          type: 'columns', columnCount: 2, columnGap: 12,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'image', imageUrl: IMG_SQ1, imageAlt: 'Image 1', alignment: 'center' },
            { type: 'image', imageUrl: IMG_SQ2, imageAlt: 'Image 2', alignment: 'center' },
          ],
        }),
      ],
    },
    {
      id: 'img-3col',
      name: '3-column images',
      description: 'Three images in a row',
      blocks: [
        b('img-3c1', {
          type: 'columns', columnCount: 3, columnGap: 10,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'image', imageUrl: IMG_SQ1, imageAlt: 'Image 1', alignment: 'center' },
            { type: 'image', imageUrl: IMG_SQ2, imageAlt: 'Image 2', alignment: 'center' },
            { type: 'image', imageUrl: IMG_SQ3, imageAlt: 'Image 3', alignment: 'center' },
          ],
        }),
      ],
    },
    {
      id: 'img-caption',
      name: 'Image with caption',
      description: 'Image + small caption text below',
      blocks: [
        b('img-ca1', { type: 'image', imageUrl: IMG_LANDSCAPE2, imageAlt: 'Image', imageWidth: 100, alignment: 'center', paddingTop: 8, paddingBottom: 4, paddingLeft: 0, paddingRight: 0 }),
        b('img-ca2', { type: 'text', textContent: 'Image caption goes here', fontSize: 12, color: '#AAAAAA', alignment: 'center', paddingTop: 4, paddingBottom: 8, paddingLeft: 0, paddingRight: 0 }),
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 4 · Headers
// ─────────────────────────────────────────────────────────────────────────────

const HEADERS: SectionCategory = {
  id: 'headers',
  label: 'Headers',
  sections: [
    {
      id: 'hdr-simple',
      name: 'Simple brand header',
      description: 'Centred brand name + divider',
      blocks: [
        b('hdr-s1', { type: 'heading', headingTag: 'h1', headingText: 'Your Brand', fontSize: 28, color: '#1B1B1B', alignment: 'center', paddingTop: 24, paddingBottom: 8, paddingLeft: 0, paddingRight: 0 }),
        b('hdr-s2', { type: 'divider', dividerColor: '#E5E7EB', dividerThickness: 1, paddingTop: 8, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
      ],
    },
    {
      id: 'hdr-announcement',
      name: 'Announcement + brand',
      description: 'Coloured announcement bar + brand heading',
      blocks: [
        b('hdr-a1', {
          type: 'html',
          paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
          htmlContent: `<div style="background:#16DAC1;padding:10px 16px;text-align:center;border-radius:4px 4px 0 0;">
  <p style="color:#FFF;font-size:13px;font-weight:700;margin:0;">🎉 Free shipping on orders over $50 — Limited time!</p>
</div>`,
        }),
        b('hdr-a2', { type: 'heading', headingTag: 'h1', headingText: 'Your Brand', fontSize: 26, color: '#1B1B1B', alignment: 'center', paddingTop: 20, paddingBottom: 8, paddingLeft: 0, paddingRight: 0 }),
        b('hdr-a3', { type: 'divider', dividerColor: '#E5E7EB', dividerThickness: 1, paddingTop: 4, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
      ],
    },
    {
      id: 'hdr-logo-nav',
      name: 'Logo + navigation',
      description: 'Brand name left + nav links right',
      blocks: [
        b('hdr-ln1', {
          type: 'html',
          paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
          htmlContent: `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td style="padding:18px 0;"><span style="font-size:22px;font-weight:900;color:#1B1B1B;">Brand</span></td>
    <td style="padding:18px 0;text-align:right;">
      <a href="#" style="font-size:13px;color:#555;text-decoration:none;margin-left:24px;">Home</a>
      <a href="#" style="font-size:13px;color:#555;text-decoration:none;margin-left:24px;">Products</a>
      <a href="#" style="font-size:13px;color:#555;text-decoration:none;margin-left:24px;">Contact</a>
    </td>
  </tr>
</table>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:0;">`,
        }),
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 5 · Footer & signatures
// ─────────────────────────────────────────────────────────────────────────────

const FOOTER: SectionCategory = {
  id: 'footer',
  label: 'Footer & signatures',
  sections: [
    {
      id: 'ftr-social',
      name: 'Footer with social links',
      description: 'Social icons + copyright + unsubscribe',
      blocks: [
        b('ftr-s0', { type: 'divider', dividerColor: '#E5E7EB', dividerThickness: 1, paddingTop: 16, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
        b('ftr-s1', {
          type: 'social', alignment: 'center',
          socialIconSize: 32, socialIconBgColor: '', socialIconColor: '#FFFFFF', socialIconRadius: 50,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          socialLinks: [
            { platform: 'facebook', url: 'https://facebook.com', enabled: true },
            { platform: 'instagram', url: 'https://instagram.com', enabled: true },
            { platform: 'twitter', url: 'https://twitter.com', enabled: true },
            { platform: 'linkedin', url: 'https://linkedin.com', enabled: false },
            { platform: 'youtube', url: 'https://youtube.com', enabled: false },
            { platform: 'tiktok', url: 'https://tiktok.com', enabled: false },
          ] as SocialLink[],
        }),
        b('ftr-s2', { type: 'text', textContent: '© 2025 Your Company. All rights reserved.', fontSize: 12, color: '#AAAAAA', alignment: 'center', paddingTop: 8, paddingBottom: 4, paddingLeft: 0, paddingRight: 0 }),
        b('ftr-s3', { type: 'text', textContent: '<a href="{{unsubscribe_url}}" style="color:#aaa;text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; <a href="#" style="color:#aaa;text-decoration:underline;">Privacy Policy</a>', fontSize: 11, color: '#AAAAAA', alignment: 'center', paddingTop: 0, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
      ],
    },
    {
      id: 'ftr-minimal',
      name: 'Minimal footer',
      description: 'Copyright + unsubscribe link only',
      blocks: [
        b('ftr-m0', { type: 'divider', dividerColor: '#E5E7EB', dividerThickness: 1, paddingTop: 16, paddingBottom: 12, paddingLeft: 0, paddingRight: 0 }),
        b('ftr-m1', { type: 'text', textContent: '© 2025 Your Company &nbsp;·&nbsp; <a href="{{unsubscribe_url}}" style="color:#aaa;text-decoration:underline;">Unsubscribe</a>', fontSize: 11, color: '#AAAAAA', alignment: 'center', paddingTop: 4, paddingBottom: 16, paddingLeft: 0, paddingRight: 0 }),
      ],
    },
    {
      id: 'ftr-signature',
      name: 'Personal signature',
      description: 'Avatar + name + title + contact info',
      blocks: [
        b('ftr-sig0', { type: 'divider', dividerColor: '#E5E7EB', dividerThickness: 1, paddingTop: 16, paddingBottom: 12, paddingLeft: 0, paddingRight: 0 }),
        b('ftr-sig1', {
          type: 'columns', columnCount: 2, columnGap: 16,
          paddingTop: 4, paddingBottom: 16, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'image', imageUrl: IMG_AVATAR, imageAlt: 'Signature', alignment: 'center' },
            { type: 'text', alignment: 'left', textContent: `<p style="font-size:17px;font-weight:800;color:#1B1B1B;margin:0 0 2px;">Anna Smith</p><p style="font-size:13px;color:#888;margin:0 0 8px;">Marketing Manager</p><p style="font-size:13px;color:#555;line-height:1.6;margin:0;">anna@yourcompany.com<br>+1 (555) 000-0000</p>` },
          ],
        }),
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 6 · Empty columns
// ─────────────────────────────────────────────────────────────────────────────

const COLUMNS: SectionCategory = {
  id: 'columns',
  label: 'Empty columns',
  sections: [
    {
      id: 'col-2eq',
      name: '2 equal columns',
      description: 'Blank 2-column layout',
      blocks: [
        b('col-2e1', {
          type: 'columns', columnCount: 2, columnGap: 20,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', textContent: 'Column 1 content', alignment: 'left' },
            { type: 'text', textContent: 'Column 2 content', alignment: 'left' },
          ],
        }),
      ],
    },
    {
      id: 'col-3eq',
      name: '3 equal columns',
      description: 'Blank 3-column layout',
      blocks: [
        b('col-3e1', {
          type: 'columns', columnCount: 3, columnGap: 16,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'text', textContent: 'Column 1 content', alignment: 'left' },
            { type: 'text', textContent: 'Column 2 content', alignment: 'left' },
            { type: 'text', textContent: 'Column 3 content', alignment: 'left' },
          ],
        }),
      ],
    },
    {
      id: 'col-2h',
      name: 'Heading + body (2 col)',
      description: 'Heading column on the left, text on the right',
      blocks: [
        b('col-2h1', {
          type: 'columns', columnCount: 2, columnGap: 28,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'heading', headingText: 'Section heading', headingTag: 'h3', alignment: 'left' },
            { type: 'text', textContent: 'Your content goes here. Add text, images, or buttons to this column.', alignment: 'left' },
          ],
        }),
      ],
    },
    {
      id: 'col-img-text',
      name: 'Image + text (2 col)',
      description: 'Image placeholder left, text placeholder right',
      blocks: [
        b('col-it1', {
          type: 'columns', columnCount: 2, columnGap: 20,
          paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
          columnItems: [
            { type: 'image', imageUrl: '', imageAlt: 'Image', alignment: 'center' },
            { type: 'text', textContent: 'Your content goes here.', alignment: 'left' },
          ],
        }),
      ],
    },
  ],
}

// ─── Final export ──────────────────────────────────────────────────────────────

export const SECTION_CATEGORIES: SectionCategory[] = [
  TEXT_IMAGES,
  TEXT,
  IMAGES,
  HEADERS,
  FOOTER,
  COLUMNS,
]
