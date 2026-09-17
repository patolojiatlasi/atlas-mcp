# Privacy Policy / Gizlilik Politikası

**Histopathology Atlas / Patoloji Atlası connector for ChatGPT, Claude and other MCP clients**
Effective / Yürürlük tarihi: 2026-09-17

[English](#english) · [Türkçe](#türkçe)

---

## English

This policy covers the Histopathology Atlas MCP server at `https://atlas-mcp.serdarbalci.workers.dev/mcp` and its slide viewer. It does not cover the AI assistant you use it from.

### Summary
- No accounts, no sign-in, no cookies, no analytics, no advertising.
- The server does not store your searches.
- Please do not type patient names, record numbers or any other identifying information into your questions.

### What the server receives
When your AI assistant uses the connector, it sends the server only the tool input:
- the search text (for example "signet ring cell carcinoma"), or
- a slide identifier (for example `lymphocytic-gastritis/CD3`).

The server matches that input against a fixed, public list of atlas slides and returns the result. It does not receive your name, email address, account details or the rest of your conversation.

### What is stored
- **Search text and slide identifiers:** not stored. They are processed in memory to answer the request and then discarded.
- **Diagnostic logs:** for troubleshooting, the server writes one line per request with the request type, the tool or resource name (for example `tools/call show_slide`), and the client application's name and protocol version (for example `claude-ai`). It never logs the search text or any other tool input. These lines appear only while the maintainer is watching a live log stream and are not kept.
- **Hosting provider logs:** the server runs on Cloudflare Workers. Cloudflare may process technical data such as IP addresses and request metadata to operate and secure its network, under the [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

### The slide viewer
The viewer runs inside your AI assistant and loads content directly from your device:
- viewer code (OpenSeadragon and the MCP Apps library) from [jsDelivr](https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net);
- slide image tiles from `images.patolojiatlasi.com`, which is hosted on [GitHub Pages](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

These providers receive standard web request data, such as IP address and browser type, under their own policies. The viewer sets no cookies and stores nothing on your device.

The "Open in atlas" button opens `patolojiatlasi.com` or `histopathologyatlas.com`, which have their own privacy practices.

### Your AI assistant
Your conversation, including any text you type, is handled by the assistant's provider (for example [OpenAI](https://openai.com/policies/privacy-policy/) or [Anthropic](https://www.anthropic.com/legal/privacy)) under that provider's privacy policy.

### Health information
The atlas contains de-identified educational images, and the connector is not intended to process personal health information. Do not enter patient identifiers or other personal data about patients.

### Audience
The connector is meant for medical students, residents, pathologists and other health professionals. It is not directed at children.

### Changes
If this policy changes, the effective date above will be updated. The change history is kept in this repository's commit log.

### Contact
- Questions or requests: open an issue at <https://github.com/patolojiatlasi/atlas-mcp/issues>, or email serdarbalci@serdarbalci.com.

---

## Türkçe

Bu politika, `https://atlas-mcp.serdarbalci.workers.dev/mcp` adresindeki Patoloji Atlası MCP sunucusunu ve kesit görüntüleyicisini kapsar. Onu kullandığınız yapay zekâ asistanını kapsamaz.

### Özet
- Hesap, oturum açma, çerez, analiz aracı veya reklam yoktur.
- Sunucu aramalarınızı saklamaz.
- Sorularınıza hasta adı, protokol numarası veya kimliği belirleyen başka bir bilgi yazmayın.

### Sunucuya ne gönderilir
Yapay zekâ asistanınız bağlayıcıyı kullandığında sunucuya yalnızca araç girdisini gönderir:
- arama metni (örneğin "taşlı yüzük hücreli karsinom") veya
- kesit kimliği (örneğin `lymphocytic-gastritis/CD3`).

Sunucu bu girdiyi atlasın sabit ve herkese açık kesit listesinde arar ve sonucu döndürür. Adınız, e-posta adresiniz, hesap bilgileriniz veya konuşmanın geri kalanı sunucuya ulaşmaz.

### Ne saklanır
- **Arama metni ve kesit kimlikleri:** saklanmaz. İsteği yanıtlamak için bellekte işlenir, ardından silinir.
- **Tanılama kayıtları:** sorun gidermek için sunucu her istek için bir satır yazar; bu satırda yalnızca istek türü, araç ya da kaynak adı (örneğin `tools/call show_slide`) ve istemci uygulamanın adı ile protokol sürümü (örneğin `claude-ai`) bulunur. Arama metni ve diğer araç girdileri asla kaydedilmez. Bu satırlar yalnızca bakımı yapan kişi canlı kayıt akışını izlerken görünür ve saklanmaz.
- **Barındırma sağlayıcısı kayıtları:** sunucu Cloudflare Workers üzerinde çalışır. Cloudflare, ağını işletmek ve korumak için IP adresi ve istek bilgileri gibi teknik verileri [Cloudflare Gizlilik Politikası](https://www.cloudflare.com/privacypolicy/) kapsamında işleyebilir.

### Kesit görüntüleyici
Görüntüleyici yapay zekâ asistanınızın içinde çalışır ve içeriği doğrudan cihazınızdan yükler:
- görüntüleyici kodu (OpenSeadragon ve MCP Apps kütüphanesi) [jsDelivr](https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net) üzerinden;
- kesit görüntü parçaları, [GitHub Pages](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) üzerinde barındırılan `images.patolojiatlasi.com` adresinden.

Bu sağlayıcılar IP adresi ve tarayıcı türü gibi standart web isteği bilgilerini kendi politikaları kapsamında alır. Görüntüleyici çerez kullanmaz ve cihazınıza bir şey kaydetmez.

"Atlasta aç" düğmesi `patolojiatlasi.com` veya `histopathologyatlas.com` adresini açar; bu sitelerin kendi gizlilik uygulamaları vardır.

### Yapay zekâ asistanınız
Yazdığınız metin dahil konuşmanız, asistanı sağlayan şirket tarafından (örneğin [OpenAI](https://openai.com/policies/privacy-policy/) veya [Anthropic](https://www.anthropic.com/legal/privacy)) o şirketin gizlilik politikasına göre işlenir.

### Sağlık bilgileri
Atlas, kimliksizleştirilmiş eğitim amaçlı görüntüler içerir ve bağlayıcı kişisel sağlık verisi işlemek için tasarlanmamıştır. Hasta kimlik bilgisi veya hastalara ait başka kişisel veri girmeyin.

### Hedef kitle
Bağlayıcı; tıp öğrencileri, asistanlar, patologlar ve diğer sağlık profesyonelleri içindir. Çocuklara yönelik değildir.

### Değişiklikler
Politika değişirse yukarıdaki yürürlük tarihi güncellenir. Değişiklik geçmişi bu deponun commit kayıtlarında tutulur.

### İletişim
- Soru veya talepler için <https://github.com/patolojiatlasi/atlas-mcp/issues> adresinde bir konu açın ya da serdarbalci@serdarbalci.com adresine yazın.
