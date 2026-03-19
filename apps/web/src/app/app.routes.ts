import { Routes } from '@angular/router';
import { StorefrontLayout } from './layouts/storefront/storefront-layout';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'backoffice',
    canActivate: [authGuard, roleGuard('STAFF', 'ADMIN')],
    loadComponent: () =>
      import('./layouts/backoffice/backoffice-layout').then(
        (m) => m.BackofficeLayout,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/backoffice/dashboard/dashboard-page').then(
            (m) => m.DashboardPage,
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/backoffice/orders/order-list').then(
            (m) => m.BoOrderListPage,
          ),
      },
      {
        path: 'orders/:orderId',
        loadComponent: () =>
          import('./features/backoffice/orders/order-detail').then(
            (m) => m.BoOrderDetailPage,
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/backoffice/products/product-list').then(
            (m) => m.BoProductListPage,
          ),
      },
      {
        path: 'products/new',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/products/product-form').then(
            (m) => m.BoProductFormPage,
          ),
      },
      {
        path: 'products/:productId/edit',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/products/product-form').then(
            (m) => m.BoProductFormPage,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/backoffice/categories/category-list').then(
            (m) => m.BoCategoryListPage,
          ),
      },
      {
        path: 'categories/new',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/categories/category-form').then(
            (m) => m.BoCategoryFormPage,
          ),
      },
      {
        path: 'categories/:categoryId/edit',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/categories/category-form').then(
            (m) => m.BoCategoryFormPage,
          ),
      },
      {
        path: 'brands',
        loadComponent: () =>
          import('./features/backoffice/brands/brand-list').then(
            (m) => m.BoBrandListPage,
          ),
      },
      {
        path: 'brands/new',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/brands/brand-form').then(
            (m) => m.BoBrandFormPage,
          ),
      },
      {
        path: 'brands/:brandId/edit',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/brands/brand-form').then(
            (m) => m.BoBrandFormPage,
          ),
      },
      {
        path: 'reports/daily-sales',
        loadComponent: () =>
          import('./features/backoffice/reports/daily-sales').then(
            (m) => m.BoDailySalesPage,
          ),
      },
      {
        path: 'analytics',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/analytics/analytics-page').then(
            (m) => m.BoAnalyticsPage,
          ),
      },
      {
        path: 'users',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/users/user-list').then(
            (m) => m.BoUserListPage,
          ),
      },
      {
        path: 'users/new/:role',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/backoffice/users/user-form').then(
            (m) => m.BoUserFormPage,
          ),
      },
    ],
  },
  {
    path: '',
    component: StorefrontLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/login/login').then((m) => m.Login),
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/register/register').then((m) => m.Register),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/catalog/product-list/product-list').then(
            (m) => m.ProductList,
          ),
      },
      {
        path: 'products/:slug',
        loadComponent: () =>
          import('./features/catalog/product-detail/product-detail').then(
            (m) => m.ProductDetailPage,
          ),
      },
      {
        path: 'categories/:slug',
        loadComponent: () =>
          import('./features/catalog/product-list/product-list').then(
            (m) => m.ProductList,
          ),
      },
      {
        path: 'brands/:slug',
        loadComponent: () =>
          import('./features/catalog/product-list/product-list').then(
            (m) => m.ProductList,
          ),
      },
      {
        path: 'cart',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/cart/cart-page').then((m) => m.CartPage),
      },
      {
        path: 'checkout',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/checkout/checkout-page').then(
            (m) => m.CheckoutPage,
          ),
      },
      {
        path: 'checkout/confirmation',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/checkout/order-confirmation').then(
            (m) => m.OrderConfirmationPage,
          ),
      },
      {
        path: 'account/orders',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/orders/order-history').then(
            (m) => m.OrderHistoryPage,
          ),
      },
      {
        path: 'account/orders/:orderId',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/orders/order-detail').then(
            (m) => m.OrderDetailPage,
          ),
      },
      {
        path: 'account/addresses',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/account/addresses/address-list').then(
            (m) => m.AddressList,
          ),
      },
      {
        path: 'account/addresses/new',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/account/addresses/address-form').then(
            (m) => m.AddressForm,
          ),
      },
      {
        path: 'account/addresses/:addressId/edit',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/account/addresses/address-form').then(
            (m) => m.AddressForm,
          ),
      },
      {
        path: 'account/profile',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/account/profile/profile-page').then(
            (m) => m.ProfilePage,
          ),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/not-found/not-found').then((m) => m.NotFoundPage),
      },
    ],
  },
];
