const header = document.querySelector("header");
const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#primary-navigation");
const mobileMenu = window.matchMedia("(max-width: 800px)");

function closeMenu() {
    header.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
}

menuToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
});

navigation.addEventListener("click", (event) => {
    if (mobileMenu.matches && event.target.closest("a")) {
        closeMenu();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeMenu();
    }
});

mobileMenu.addEventListener("change", closeMenu);

const storeApi = "https://fauneye.com/wp-json/wc/store/v1";
const storeCartUrl = "https://fauneye.com/cart/";

async function getProducts() {
    const response = await fetch(`${storeApi}/products?per_page=100`, {
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        throw new Error(`The store returned ${response.status}.`);
    }

    return response.json();
}

function getProductCategory(product) {
    return product.categories?.length
        ? product.categories.map((category) => category.name).join(", ")
        : "Uncategorized";
}

function getProductCategories(product) {
    return product.categories?.length
        ? product.categories.map((category) => category.name)
        : ["Uncategorized"];
}

function getProductPrice(product) {
    const { price, currency_code: currency, currency_minor_unit: decimals } = product.prices;

    if (price === null || price === undefined || price === "") {
        return "Price unavailable";
    }

    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(Number(price) / (10 ** decimals));
}

function createDescriptionContent(html) {
    const source = new DOMParser().parseFromString(html || "", "text/html");
    const output = document.createDocumentFragment();
    const allowedTags = new Set(["P", "BR", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "A"]);

    function copySafeNodes(sourceNode, targetNode) {
        for (const child of sourceNode.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                targetNode.append(document.createTextNode(child.textContent));
                continue;
            }

            if (child.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }

            if (!allowedTags.has(child.tagName)) {
                copySafeNodes(child, targetNode);
                continue;
            }

            const element = document.createElement(child.tagName.toLowerCase());
            if (child.tagName === "A") {
                try {
                    const url = new URL(child.getAttribute("href"), window.location.href);
                    if (url.protocol === "https:" || url.protocol === "http:") {
                        element.href = url.href;
                        element.rel = "noopener noreferrer";
                    }
                } catch {
                    // Ignore invalid or unsafe links in product descriptions.
                }
            }
            copySafeNodes(child, element);
            targetNode.append(element);
        }
    }

    copySafeNodes(source.body, output);
    return output;
}

function createProductCard(product, featured = false) {
    const card = document.createElement("a");
    const image = product.images?.[0];
    card.className = featured ? "book-card" : "catalog-book-card";
    card.href = `book-details.html?product=${encodeURIComponent(product.id)}`;
    card.setAttribute("aria-label", `${product.name} — view details`);

    if (image?.src) {
        const cover = document.createElement("img");
        cover.className = featured ? "featured-product-image" : "catalog-cover";
        cover.src = image.src;
        cover.alt = image.alt || `Cover of ${product.name}`;
        cover.loading = "lazy";
        card.append(cover);
    } else {
        const cover = document.createElement("div");
        cover.className = featured ? "featured-product-placeholder" : "catalog-cover product-cover-placeholder";
        cover.setAttribute("aria-hidden", "true");
        cover.textContent = product.name;
        card.append(cover);
    }

    const info = document.createElement("div");
    info.className = featured ? "book-card-content" : "catalog-card-info";

    const category = document.createElement("p");
    category.className = "book-category";
    category.textContent = getProductCategory(product);

    const title = document.createElement("h3");
    title.textContent = product.name;

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = getProductPrice(product);

    const linkText = document.createElement("span");
    linkText.className = "book-card-link";
    linkText.textContent = "Explore this book →";

    info.append(category, title, price, linkText);
    card.append(info);
    return card;
}

function showCatalogError(status, message) {
    if (status) {
        status.textContent = message;
    }
}

async function renderCatalog() {
    const catalog = document.querySelector("#product-catalog");
    const featuredGrid = document.querySelector("#featured-product-grid");
    const status = document.querySelector(".catalog-status");

    if (!catalog && !featuredGrid) {
        return;
    }

    try {
        const products = await getProducts();
        if (!products.length) {
            showCatalogError(status, "There are no published books yet. Add products in WordPress and they will appear here.");
            return;
        }

        if (status) {
            status.hidden = true;
        }

        if (featuredGrid) {
            products.slice(0, 3).forEach((product) => featuredGrid.append(createProductCard(product, true)));
        }

        if (catalog) {
            const groups = new Map();
            products.forEach((product) => {
                getProductCategories(product).forEach((category) => {
                    if (!groups.has(category)) {
                        groups.set(category, []);
                    }
                    groups.get(category).push(product);
                });
            });

            groups.forEach((groupProducts, categoryName) => {
                const section = document.createElement("section");
                section.className = "book-category-section";
                const heading = document.createElement("div");
                heading.className = "category-heading";
                const title = document.createElement("h2");
                title.textContent = categoryName;
                const count = document.createElement("span");
                count.textContent = `${groupProducts.length} ${groupProducts.length === 1 ? "book" : "books"}`;
                heading.append(title, count);

                const grid = document.createElement("div");
                grid.className = "catalog-grid";
                groupProducts.forEach((product) => grid.append(createProductCard(product)));
                section.append(heading, grid);
                catalog.append(section);
            });
        }
    } catch (error) {
        console.error("Could not load WooCommerce products:", error);
        showCatalogError(status, "Books could not be loaded. Check that the WordPress Store API is available and the storefront is hosted over HTTPS.");
    }
}

function renderProductDetail() {
    const bookDetail = document.querySelector("#book-detail .book-detail-content");
    if (!bookDetail) {
        return;
    }

    const productId = new URLSearchParams(window.location.search).get("product");
    const status = document.createElement("p");
    status.className = "catalog-status";
    status.setAttribute("role", "status");

    if (!productId) {
        bookDetail.hidden = true;
        status.textContent = "Choose a book from the catalog to see its details.";
        bookDetail.before(status);
        return;
    }

    const cover = bookDetail.querySelector("img");
    const category = bookDetail.querySelector(".book-category");
    const title = bookDetail.querySelector("h1");
    const price = bookDetail.querySelector(".product-price");
    const description = bookDetail.querySelector(".product-description");
    const addToCart = bookDetail.querySelector(".button");

    fetch(`${storeApi}/products/${encodeURIComponent(productId)}`, {
        headers: { Accept: "application/json" }
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`The store returned ${response.status}.`);
            }
            return response.json();
        })
        .then((product) => {
            document.title = `${product.name} | Fauneye Studio`;
            category.textContent = getProductCategory(product);
            title.textContent = product.name;
            price.textContent = getProductPrice(product);
            description.replaceChildren(createDescriptionContent(product.description || product.short_description));
            description.classList.add("product-description");

            const image = product.images?.[0];
            if (image?.src) {
                cover.src = image.src;
                cover.alt = image.alt || `Cover of ${product.name}`;
                cover.hidden = false;
            } else {
                cover.hidden = true;
            }

            addToCart.href = `${storeCartUrl}?add-to-cart=${encodeURIComponent(product.id)}&quantity=1`;
            addToCart.textContent = "Add to cart";
            addToCart.hidden = !product.is_purchasable || !product.is_in_stock;
        })
        .catch((error) => {
            console.error("Could not load WooCommerce product:", error);
            bookDetail.hidden = true;
            status.textContent = "This book could not be found. It may be unpublished or unavailable.";
            bookDetail.before(status);
        });
}

renderCatalog();
renderProductDetail();
