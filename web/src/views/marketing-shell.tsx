/** @jsxImportSource hono/jsx */

import { PropsWithChildren } from "hono/jsx";
import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import { getEnv } from "../lib/env";

type MarketingShellProps = PropsWithChildren<{
  title: string;
  description: string;
  currentPath:
    | "/"
    | "/downloads"
    | "/shop"
    | "/contact"
    | "/agent-market"
    | "/market";
}>;

const topNavItems = [
  { href: "/", label: "首页" },
  { href: "/downloads", label: "下载" },
  { href: "/shop", label: "商城" },
  { href: "/market", label: "众包市场" },
  { href: "/contact", label: "联系我们" },
] as const;

export function renderMarketingShell({
  title,
  description,
  currentPath,
  children,
}: MarketingShellProps): string {
  const {
    brandName,
    brandLogoUrl,
    brandUrl,
    brandDomain,
    siteName,
    seoTitle,
    seoDescription,
    seoKeywords,
  } = getBrandConfig();
  const { marketplaceEnabled } = getEnv();
  const finalTitle = `${title} | ${seoTitle}`;
  const finalDescription = description?.trim() || seoDescription;
  const isHomePage = currentPath === "/";

  return `<!doctype html>${renderToString(
    <html
      lang="zh-CN"
      data-theme="winter"
      class={isHomePage ? "home-focus-enabled" : undefined}
    >
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{finalTitle}</title>
        <meta name="description" content={finalDescription} />
        <meta name="keywords" content={seoKeywords} />
        <meta property="og:title" content={finalTitle} />
        <meta property="og:description" content={finalDescription} />
        <meta property="og:site_name" content={siteName} />
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body
        class={`min-h-screen bg-base-100 text-base-content${
          isHomePage ? " home-focus-enabled" : ""
        }`}
      >
        <a
          href="#main-content"
          class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-box focus:bg-base-100 focus:px-4 focus:py-2 focus:shadow"
        >
          跳转到主要内容
        </a>

        <header class="sticky top-0 z-40 border-b border-base-200/70 bg-base-100/85 backdrop-blur">
          <div class="navbar mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="navbar-start">
              <a href="/" class="btn btn-ghost px-2 text-lg font-semibold">
                <img
                  src={brandLogoUrl}
                  alt={`${brandName} logo`}
                  class="h-8 w-8 rounded"
                />
                <span>{brandName}</span>
              </a>
            </div>
            <div class="navbar-center hidden lg:flex">
              <ul class="menu menu-horizontal px-1 text-sm">
                {topNavItems.map((item) => (
                  <li>
                    <a
                      href={item.href}
                      class={
                        item.href === currentPath ? "active font-semibold" : ""
                      }
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div class="navbar-end gap-2">
              <a
                href="/contact"
                class="btn btn-primary btn-sm hidden sm:inline-flex"
              >
                咨询方案
              </a>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          class={isHomePage ? "focus-scroll-page" : undefined}
        >
          {children}
        </main>

        <footer class="border-t border-base-200 bg-base-100">
          <div class="footer mx-auto max-w-7xl items-center px-4 py-8 text-base-content sm:px-6 lg:px-8">
            <aside>
              <p class="font-semibold">
                <a
                  class="link link-hover"
                  href={brandUrl}
                  target="_blank"
                  rel="noreferrer"
                >{`${brandName} · ${brandDomain}`}</a>
              </p>
              <p class="text-sm text-base-content/60">
                让 Agent 协作更标准，让任务交付更稳定。
              </p>
            </aside>
            <nav class="md:place-self-center md:justify-self-end">
              <div class="grid grid-flow-col gap-4 text-sm">
                {marketplaceEnabled ? (
                  <a class="link link-hover" href="/market">
                    Agent 协作
                  </a>
                ) : null}
                <a class="link link-hover" href="/downloads">
                  下载试用
                </a>
                <a class="link link-hover" href="/shop">
                  产品商城
                </a>
                <a class="link link-hover" href="/contact">
                  部署评估
                </a>
              </div>
            </nav>
          </div>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('DOMContentLoaded', function() {
            var carousel = document.getElementById('carousel');
            if (carousel) {
              var indicators = document.querySelectorAll('.carousel-indicator');
              var currentIndex = 0;
              var totalSlides = 3;
              
              function updateCarousel() {
                carousel.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
                indicators.forEach(function(indicator, index) {
                  if (index === currentIndex) {
                    indicator.classList.add('bg-primary-600');
                    indicator.classList.remove('bg-gray-300');
                  } else {
                    indicator.classList.remove('bg-primary-600');
                    indicator.classList.add('bg-gray-300');
                  }
                });
              }
              
              function nextSlide() {
                currentIndex = (currentIndex + 1) % totalSlides;
                updateCarousel();
              }
              
              indicators.forEach(function(indicator, index) {
                indicator.addEventListener('click', function() {
                  currentIndex = index;
                  updateCarousel();
                });
              });
              
              // 自动轮播
              setInterval(nextSlide, 5000);
            }

            if (document.body.classList.contains('home-focus-enabled')) {
              var focusSections = Array.from(
                document.querySelectorAll('.focus-scroll-page > .marketing-section')
              );
              var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
              var desktopViewport = window.matchMedia('(min-width: 1024px)');
              var header = document.querySelector('header');
              var isAnimatingScroll = false;
              var wheelLockUntil = 0;

              function clearFocusClasses() {
                focusSections.forEach(function(section) {
                  section.classList.remove('is-focused', 'is-nearby', 'is-dimmed');
                });
              }

              function getFocusCenter() {
                var headerHeight = header ? header.getBoundingClientRect().height : 0;
                return headerHeight + ((window.innerHeight - headerHeight) / 2);
              }

              function getSectionTargetTop(section) {
                var rect = section.getBoundingClientRect();
                return window.scrollY + rect.top + (rect.height / 2) - getFocusCenter();
              }

              function getClosestSectionIndex() {
                var focusCenter = getFocusCenter();
                var activeIndex = 0;
                var nearestDistance = Number.POSITIVE_INFINITY;

                focusSections.forEach(function(section, index) {
                  var rect = section.getBoundingClientRect();
                  var sectionCenter = rect.top + (rect.height / 2);
                  var distance = Math.abs(sectionCenter - focusCenter);

                  if (distance < nearestDistance) {
                    nearestDistance = distance;
                    activeIndex = index;
                  }
                });

                return activeIndex;
              }

              function scrollToSection(index) {
                var boundedIndex = Math.max(0, Math.min(index, focusSections.length - 1));
                var targetSection = focusSections[boundedIndex];
                if (!targetSection) {
                  return;
                }

                isAnimatingScroll = true;
                wheelLockUntil = Date.now() + 520;
                window.scrollTo({
                  top: Math.max(0, getSectionTargetTop(targetSection)),
                  behavior: 'smooth'
                });

                window.setTimeout(function() {
                  isAnimatingScroll = false;
                  applyFocusClasses();
                }, 540);
              }

              function applyFocusClasses() {
                if (focusSections.length < 2 || reduceMotion.matches || !desktopViewport.matches) {
                  clearFocusClasses();
                  return;
                }

                var activeIndex = getClosestSectionIndex();

                focusSections.forEach(function(section, index) {
                  section.classList.toggle('is-focused', index === activeIndex);
                  section.classList.toggle('is-nearby', Math.abs(index - activeIndex) === 1);
                  section.classList.toggle('is-dimmed', Math.abs(index - activeIndex) > 1);
                });
              }

              var ticking = false;
              function requestFocusUpdate() {
                if (ticking) {
                  return;
                }

                ticking = true;
                window.requestAnimationFrame(function() {
                  applyFocusClasses();
                  ticking = false;
                });
              }

              applyFocusClasses();
              window.addEventListener('scroll', requestFocusUpdate, { passive: true });
              window.addEventListener('resize', requestFocusUpdate);
              window.addEventListener('wheel', function(event) {
                if (focusSections.length < 2 || reduceMotion.matches || !desktopViewport.matches) {
                  return;
                }

                if (Math.abs(event.deltaY) < 12 || isAnimatingScroll || Date.now() < wheelLockUntil) {
                  return;
                }

                event.preventDefault();
                var currentIndex = getClosestSectionIndex();
                var direction = event.deltaY > 0 ? 1 : -1;
                scrollToSection(currentIndex + direction);
              }, { passive: false });

              if (typeof reduceMotion.addEventListener === 'function') {
                reduceMotion.addEventListener('change', requestFocusUpdate);
                desktopViewport.addEventListener('change', requestFocusUpdate);
              }
            }
          });
        ` }} />
      </body>
    </html>,
  )}`;
}
