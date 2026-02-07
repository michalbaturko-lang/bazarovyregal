/* ==========================================================================
   billing-page.js  -  Billing & Subscription Management
   Premium pricing page with plan comparison, usage meters, and Stripe integration
   ========================================================================== */

const BillingPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let currentPlan = null;
  let usageData = null;
  let plans = [];
  let stripeConfigured = false;

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchPlans() {
    try {
      plans = await App.api('/billing/plans');
    } catch (_) {
      plans = [];
    }
  }

  async function fetchCurrentPlan() {
    try {
      currentPlan = await App.api('/billing/current?project_id=' + App.state.project);
      stripeConfigured = currentPlan.stripe_configured || false;
    } catch (_) {
      currentPlan = null;
    }
  }

  async function fetchUsage() {
    try {
      usageData = await App.api('/billing/usage?project_id=' + App.state.project);
    } catch (_) {
      usageData = null;
    }
  }

  /* ------------------------------------------------------------------
     Actions
  ------------------------------------------------------------------ */
  async function handleUpgrade(planId) {
    if (!stripeConfigured) {
      Components.toast('Stripe is not configured. Running in self-hosted mode.', 'info');
      return;
    }

    try {
      const result = await App.api('/billing/checkout', {
        method: 'POST',
        body: { plan_id: planId, project_id: App.state.project },
      });

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (_) {
      // Error already shown by App.api
    }
  }

  async function handleManageSubscription() {
    if (!stripeConfigured) {
      Components.toast('Stripe is not configured. Running in self-hosted mode.', 'info');
      return;
    }

    try {
      const result = await App.api('/billing/portal?project_id=' + App.state.project);
      if (result.portal_url) {
        window.location.href = result.portal_url;
      }
    } catch (_) {
      // Error already shown by App.api
    }
  }

  /* ------------------------------------------------------------------
     Render: Self-hosted mode banner
  ------------------------------------------------------------------ */
  function renderSelfHostedBanner() {
    return `
      <div class="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-900/30 via-slate-800 to-emerald-900/30 p-6 mb-8">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent"></div>
        <div class="relative flex items-center gap-4">
          <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-emerald-300">Self-Hosted Mode - All Features Unlocked</h3>
            <p class="text-sm text-slate-400 mt-1">
              You are running Regal Master Look in self-hosted mode. All features are available without limits.
              To enable SaaS billing, configure <code class="bg-slate-700 px-1.5 py-0.5 rounded text-emerald-400 text-xs">STRIPE_SECRET_KEY</code> in your environment variables.
            </p>
          </div>
          <div class="flex-shrink-0">
            ${Components.badge('Unlimited', 'green')}
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render: Current plan card
  ------------------------------------------------------------------ */
  function renderCurrentPlanCard() {
    if (!currentPlan || !currentPlan.plan) return '';

    const plan = currentPlan.plan;
    const usage = currentPlan.usage || {};
    const used = usage.sessions_used || 0;
    const limit = usage.sessions_limit || 0;
    const isUnlimited = limit < 0;
    const percentage = isUnlimited ? 0 : (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);

    const barColor = percentage >= 90
      ? 'bg-red-500'
      : percentage >= 70
        ? 'bg-yellow-500'
        : 'bg-blue-500';

    return `
      <div class="bg-slate-800 rounded-2xl border border-slate-700/50 p-6 mb-8">
        <div class="flex items-center justify-between mb-6">
          <div>
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-semibold text-white">Current Plan</h3>
              ${Components.badge(plan.name, plan.id === 'free' ? 'slate' : plan.id === 'pro' ? 'blue' : plan.id === 'business' ? 'purple' : 'green')}
            </div>
            <p class="text-sm text-slate-400 mt-1">
              ${plan.price === 0 ? 'Free forever' : plan.price < 0 ? 'Custom pricing' : plan.price + ' ' + (plan.currency || 'EUR') + '/month'}
            </p>
          </div>
          ${stripeConfigured && currentPlan.stripe_customer_id ? `
            <button onclick="BillingPage.manageSubscription()"
                    class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Manage Subscription
            </button>
          ` : ''}
        </div>

        <!-- Usage bar -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-slate-400">Sessions this billing cycle</span>
            <span class="text-sm font-medium text-white">
              ${App.formatNumber(used)} ${isUnlimited ? '' : '/ ' + App.formatNumber(limit)}
              ${isUnlimited ? '<span class="text-emerald-400 text-xs ml-1">Unlimited</span>' : ''}
            </span>
          </div>
          ${isUnlimited ? `
            <div class="w-full h-2.5 rounded-full bg-slate-700">
              <div class="h-full rounded-full bg-emerald-500 w-full opacity-30"></div>
            </div>
          ` : `
            <div class="w-full h-2.5 rounded-full bg-slate-700">
              <div class="h-full rounded-full ${barColor} transition-all duration-500" style="width: ${percentage}%"></div>
            </div>
            <div class="flex items-center justify-between mt-1.5">
              <span class="text-xs text-slate-500">${percentage}% used</span>
              ${percentage >= 80 ? `<span class="text-xs text-yellow-400">Consider upgrading</span>` : ''}
            </div>
          `}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render: Feature check icon
  ------------------------------------------------------------------ */
  function checkIcon() {
    return `<svg class="w-4.5 h-4.5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`;
  }

  function dashIcon() {
    return `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 12H6"/></svg>`;
  }

  /* ------------------------------------------------------------------
     Render: Pricing table
  ------------------------------------------------------------------ */
  function renderPricingTable() {
    if (!plans || plans.length === 0) return '';

    const currentPlanId = currentPlan && currentPlan.plan ? currentPlan.plan.id : 'free';

    // All features across all plans (collected for rows)
    const allFeatures = [
      'Session recording',
      'Basic analytics',
      'Heatmaps',
      'Funnels',
      'Error tracking',
      'Email reports',
      'AI Insights',
      'E-commerce analytics',
      'API access',
      'Webhooks',
      'Priority support',
      'White-label',
      'Custom domain',
      'Dedicated support',
      'SLA',
    ];

    const planCards = plans.map(plan => {
      const isCurrent = plan.id === currentPlanId;
      const isRecommended = plan.id === 'business';
      const isEnterprise = plan.id === 'enterprise';
      const isDowngrade = getPlanTier(plan.id) < getPlanTier(currentPlanId);
      const canUpgrade = !isCurrent && !isDowngrade && !isEnterprise;

      const borderClass = isRecommended
        ? 'border-transparent bg-gradient-to-b from-blue-500/20 to-purple-500/20'
        : 'border-slate-700/50';

      const outerClass = isRecommended
        ? 'bg-gradient-to-b from-blue-500/30 via-purple-500/20 to-blue-500/30 p-[1px] rounded-2xl'
        : '';

      let priceDisplay;
      if (plan.price === 0) {
        priceDisplay = '<span class="text-4xl font-bold text-white">Free</span>';
      } else if (plan.price < 0) {
        priceDisplay = '<span class="text-2xl font-bold text-white">Custom</span>';
      } else {
        priceDisplay = `
          <span class="text-4xl font-bold text-white">${plan.price}</span>
          <span class="text-sm text-slate-400 ml-1">${plan.currency || 'EUR'}/mo</span>
        `;
      }

      let buttonHtml;
      if (isCurrent) {
        buttonHtml = `
          <button disabled class="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-400 cursor-default border border-slate-600/30">
            Current Plan
          </button>`;
      } else if (isEnterprise) {
        buttonHtml = `
          <a href="mailto:support@regalmasterlook.com" class="block w-full py-2.5 rounded-lg text-sm font-medium text-center bg-slate-700 hover:bg-slate-600 text-white transition-colors border border-slate-600/30">
            Contact Sales
          </a>`;
      } else if (canUpgrade) {
        buttonHtml = `
          <button onclick="BillingPage.upgrade('${plan.id}')"
                  class="w-full py-2.5 rounded-lg text-sm font-medium transition-all
                         ${isRecommended
                           ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25'
                           : 'bg-blue-600 hover:bg-blue-700 text-white'}">
            Upgrade to ${plan.name}
          </button>`;
      } else {
        buttonHtml = `
          <button disabled class="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-700/30 text-slate-500 cursor-default border border-slate-700/30">
            Downgrade
          </button>`;
      }

      const sessionLimitDisplay = plan.sessions_limit < 0
        ? 'Unlimited'
        : App.formatNumber(plan.sessions_limit);

      const featuresHtml = plan.features.map(f =>
        `<li class="flex items-center gap-2.5 text-sm text-slate-300">
          ${checkIcon()}
          <span>${f}</span>
        </li>`
      ).join('');

      const cardInner = `
        <div class="bg-slate-800 rounded-2xl ${borderClass} p-6 flex flex-col h-full relative">
          ${isRecommended ? `
            <div class="absolute -top-3 left-1/2 -translate-x-1/2">
              <span class="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                RECOMMENDED
              </span>
            </div>
          ` : ''}
          ${isCurrent ? `
            <div class="absolute top-4 right-4">
              ${Components.badge('Current', 'green')}
            </div>
          ` : ''}

          <div class="mb-4 ${isRecommended ? 'mt-2' : ''}">
            <h3 class="text-lg font-semibold text-white">${plan.name}</h3>
          </div>

          <div class="mb-4">
            ${priceDisplay}
          </div>

          <div class="text-sm text-slate-400 mb-5 pb-5 border-b border-slate-700/50">
            <span class="font-medium text-slate-300">${sessionLimitDisplay}</span> sessions/month
          </div>

          <ul class="space-y-3 mb-6 flex-1">
            ${featuresHtml}
          </ul>

          ${buttonHtml}
        </div>
      `;

      if (isRecommended) {
        return `<div class="${outerClass}">${cardInner}</div>`;
      }
      return cardInner;
    }).join('');

    return `
      <div class="mb-8">
        <h3 class="text-lg font-semibold text-white mb-1">Choose Your Plan</h3>
        <p class="text-sm text-slate-400 mb-6">Scale your session recording as your business grows</p>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          ${planCards}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render: Usage meter (detailed)
  ------------------------------------------------------------------ */
  function renderUsageMeter() {
    if (!usageData) return '';

    const used = usageData.sessions_used || 0;
    const limit = usageData.sessions_limit || 0;
    const isUnlimited = limit < 0;
    const percentage = usageData.percentage || 0;

    const cycleStart = usageData.billing_cycle_start
      ? App.formatDate(usageData.billing_cycle_start)
      : 'N/A';

    const cycleEnd = usageData.billing_cycle_start
      ? App.formatDate(new Date(new Date(usageData.billing_cycle_start).getTime() + 30 * 24 * 60 * 60 * 1000))
      : 'N/A';

    let statusColor, statusText, statusBg;
    if (isUnlimited) {
      statusColor = 'text-emerald-400';
      statusText = 'Unlimited';
      statusBg = 'bg-emerald-500/15 border-emerald-500/20';
    } else if (percentage >= 90) {
      statusColor = 'text-red-400';
      statusText = 'Critical';
      statusBg = 'bg-red-500/15 border-red-500/20';
    } else if (percentage >= 70) {
      statusColor = 'text-yellow-400';
      statusText = 'Warning';
      statusBg = 'bg-yellow-500/15 border-yellow-500/20';
    } else {
      statusColor = 'text-blue-400';
      statusText = 'Healthy';
      statusBg = 'bg-blue-500/15 border-blue-500/20';
    }

    const barColor = isUnlimited ? 'bg-emerald-500' :
      percentage >= 90 ? 'bg-red-500' :
      percentage >= 70 ? 'bg-yellow-500' : 'bg-blue-500';

    return `
      <div class="bg-slate-800 rounded-2xl border border-slate-700/50 p-6 mb-8">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-white">Usage This Month</h3>
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusBg} ${statusColor}">${statusText}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="bg-slate-900 rounded-xl p-4">
            <div class="text-xs text-slate-400 mb-1">Sessions Used</div>
            <div class="text-2xl font-bold text-white">${App.formatNumber(used)}</div>
          </div>
          <div class="bg-slate-900 rounded-xl p-4">
            <div class="text-xs text-slate-400 mb-1">Session Limit</div>
            <div class="text-2xl font-bold text-white">${isUnlimited ? 'Unlimited' : App.formatNumber(limit)}</div>
          </div>
          <div class="bg-slate-900 rounded-xl p-4">
            <div class="text-xs text-slate-400 mb-1">Billing Cycle</div>
            <div class="text-sm font-medium text-white mt-1">${cycleStart} - ${cycleEnd}</div>
          </div>
        </div>

        ${!isUnlimited ? `
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-400">Usage</span>
              <span class="text-sm font-medium ${statusColor}">${percentage}%</span>
            </div>
            <div class="w-full h-3 rounded-full bg-slate-700 overflow-hidden">
              <div class="h-full rounded-full ${barColor} transition-all duration-700 relative" style="width: ${percentage}%">
                <div class="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 rounded-full"></div>
              </div>
            </div>
            ${percentage >= 80 ? `
              <p class="text-xs text-yellow-400 mt-2 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                </svg>
                You are approaching your session limit. Consider upgrading your plan.
              </p>
            ` : ''}
          </div>
        ` : `
          <div class="text-center py-2">
            <p class="text-sm text-slate-400">No session limit on your current plan</p>
          </div>
        `}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render: Feature comparison table
  ------------------------------------------------------------------ */
  function renderFeatureComparison() {
    const features = [
      { name: 'Session Recording', free: true, pro: true, business: true, enterprise: true },
      { name: 'Basic Analytics', free: true, pro: true, business: true, enterprise: true },
      { name: 'Heatmaps', free: false, pro: true, business: true, enterprise: true },
      { name: 'Funnels', free: false, pro: true, business: true, enterprise: true },
      { name: 'Error Tracking', free: false, pro: true, business: true, enterprise: true },
      { name: 'Email Reports', free: false, pro: true, business: true, enterprise: true },
      { name: 'AI Insights', free: false, pro: false, business: true, enterprise: true },
      { name: 'E-commerce Analytics', free: false, pro: false, business: true, enterprise: true },
      { name: 'API Access', free: false, pro: false, business: true, enterprise: true },
      { name: 'Webhooks', free: false, pro: false, business: true, enterprise: true },
      { name: 'Priority Support', free: false, pro: false, business: true, enterprise: true },
      { name: 'White-label', free: false, pro: false, business: false, enterprise: true },
      { name: 'Custom Domain', free: false, pro: false, business: false, enterprise: true },
      { name: 'Dedicated Support', free: false, pro: false, business: false, enterprise: true },
      { name: 'SLA', free: false, pro: false, business: false, enterprise: true },
    ];

    const rows = features.map(f => `
      <tr class="border-t border-slate-700/30">
        <td class="px-4 py-3 text-sm text-slate-300">${f.name}</td>
        <td class="px-4 py-3 text-center">${f.free ? checkIcon() : dashIcon()}</td>
        <td class="px-4 py-3 text-center">${f.pro ? checkIcon() : dashIcon()}</td>
        <td class="px-4 py-3 text-center">${f.business ? checkIcon() : dashIcon()}</td>
        <td class="px-4 py-3 text-center">${f.enterprise ? checkIcon() : dashIcon()}</td>
      </tr>
    `).join('');

    return `
      <div class="bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden mb-8">
        <div class="p-6 border-b border-slate-700/50">
          <h3 class="text-lg font-semibold text-white">Feature Comparison</h3>
          <p class="text-sm text-slate-400 mt-1">Detailed breakdown of what is included in each plan</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-800/80">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/3">Feature</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Free</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Pro</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider">Business</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Enterprise</th>
              </tr>
            </thead>
            <tbody class="bg-slate-800/30">
              <!-- Session limits row -->
              <tr class="border-t border-slate-700/30">
                <td class="px-4 py-3 text-sm font-medium text-white">Monthly Sessions</td>
                <td class="px-4 py-3 text-center text-sm text-slate-300">1,000</td>
                <td class="px-4 py-3 text-center text-sm text-slate-300">10,000</td>
                <td class="px-4 py-3 text-center text-sm text-slate-300">50,000</td>
                <td class="px-4 py-3 text-center text-sm text-emerald-400 font-medium">Unlimited</td>
              </tr>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */
  function getPlanTier(planId) {
    const tiers = { free: 0, pro: 1, business: 2, enterprise: 3 };
    return tiers[planId] !== undefined ? tiers[planId] : -1;
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();

    // Fetch all data in parallel
    await Promise.all([fetchPlans(), fetchCurrentPlan(), fetchUsage()]);

    // Check for checkout status in URL
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    let checkoutBanner = '';
    if (urlParams.get('checkout') === 'success') {
      checkoutBanner = `
        <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-emerald-300">Subscription activated successfully!</p>
            <p class="text-xs text-slate-400 mt-0.5">Your plan has been upgraded. New limits are now in effect.</p>
          </div>
        </div>`;
    } else if (urlParams.get('checkout') === 'cancelled') {
      checkoutBanner = `
        <div class="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <svg class="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <p class="text-sm text-yellow-300">Checkout was cancelled. Your plan has not changed.</p>
        </div>`;
    }

    const isSelfHosted = !stripeConfigured;

    container.innerHTML = `
      <div>
        ${Components.sectionHeader(
          'Billing & Plans',
          'Manage your subscription, usage, and billing details',
          stripeConfigured && currentPlan && currentPlan.stripe_customer_id ? `
            <button onclick="BillingPage.manageSubscription()"
                    class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/>
              </svg>
              Manage Billing
            </button>
          ` : ''
        )}

        ${checkoutBanner}

        ${isSelfHosted ? renderSelfHostedBanner() : ''}

        ${renderCurrentPlanCard()}

        ${renderUsageMeter()}

        ${renderPricingTable()}

        ${renderFeatureComparison()}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    upgrade: handleUpgrade,
    manageSubscription: handleManageSubscription,
  };

})();
