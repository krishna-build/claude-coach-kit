#!/usr/bin/env python3
"""
Daily Ad Creative Report for Aman
Runs at 9 PM IST — shows which ad creatives brought leads + payments today
"""

import json
import os
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from collections import defaultdict

IST = timezone(timedelta(hours=5, minutes=30))
SB_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
BASE = "https://bfdgibmgweexidmopprl.supabase.co/rest/v1"

def sb_get(table, params):
    query = urllib.parse.urlencode(params, safe='.,*')
    url = f"{BASE}/{table}?{query}"
    req = urllib.request.Request(url)
    req.add_header('apikey', SB_KEY)
    req.add_header('Authorization', f'Bearer {SB_KEY}')
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def main():
    now = datetime.now(IST)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today_start.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
    
    # Get today's visitors
    visitors = sb_get("utm_visitors", {
        "created_at": f"gte.{today_iso}",
        "select": "utm_content,utm_campaign,utm_term,customer_email,customer_name,payment_status,amount,city,device,age_group,created_at"
    })
    
    # Get today's new contacts
    contacts = sb_get("automation_contacts", {
        "created_at": f"gte.{today_iso}",
        "select": "email,first_name,utm_content,utm_campaign,paid_299,paid_299_at,city"
    })
    
    # Group by ad creative
    ad_stats = defaultdict(lambda: {
        'visitors': 0, 'leads': [], 'paid': 0, 'revenue': 0,
        'campaign': '', 'adset': '', 'cities': [], 'devices': {'mobile': 0, 'desktop': 0}
    })
    
    for v in visitors:
        ad = v.get('utm_content') or 'Unknown'
        ad_stats[ad]['visitors'] += 1
        ad_stats[ad]['campaign'] = v.get('utm_campaign') or ''
        ad_stats[ad]['adset'] = v.get('utm_term') or ''
        
        if v.get('customer_email'):
            ad_stats[ad]['leads'].append({
                'name': v.get('customer_name', ''),
                'email': v.get('customer_email', ''),
                'city': v.get('city', ''),
                'age': v.get('age_group', ''),
                'time': v.get('created_at', '')
            })
        
        if v.get('payment_status') == 'captured':
            ad_stats[ad]['paid'] += 1
            ad_stats[ad]['revenue'] += (v.get('amount') or 0)
        
        device = v.get('device', 'unknown')
        if device in ('mobile', 'desktop'):
            ad_stats[ad]['devices'][device] += 1
        
        city = v.get('city') or ''
        if city:
            ad_stats[ad]['cities'].append(city)
    
    # Build report
    date_str = now.strftime('%b %d, %Y')
    
    lines = []
    lines.append(f"📊 **Daily Ad Report — {date_str}**")
    lines.append(f"{'='*40}")
    
    total_visitors = sum(s['visitors'] for s in ad_stats.values())
    total_leads = sum(len(s['leads']) for s in ad_stats.values())
    total_paid = sum(s['paid'] for s in ad_stats.values())
    total_revenue = sum(s['revenue'] for s in ad_stats.values())
    
    lines.append(f"\n**Summary:** {total_visitors} visitors | {total_leads} leads | {total_paid} purchases | ₹{total_revenue:,}")
    lines.append("")
    
    # Sort by visitors descending
    sorted_ads = sorted(ad_stats.items(), key=lambda x: -x[1]['visitors'])
    
    for rank, (ad_name, stats) in enumerate(sorted_ads, 1):
        if ad_name == 'Unknown' and stats['visitors'] == 0:
            continue
        
        conv_rate = f"{stats['paid']*100//stats['visitors']}%" if stats['visitors'] else "0%"
        
        lines.append(f"**{rank}. {ad_name}**")
        lines.append(f"   👁 {stats['visitors']} visitors | 👤 {len(stats['leads'])} leads | 💰 {stats['paid']} paid ({conv_rate})")
        
        if stats['campaign']:
            lines.append(f"   📢 {stats['campaign']}")
        
        # Show leads
        if stats['leads']:
            for lead in stats['leads']:
                city_str = f" | 📍{lead['city']}" if lead.get('city') else ""
                age_str = f" | 🎂{lead['age']}" if lead.get('age') else ""
                lines.append(f"   → {lead['name']} ({lead['email']}){city_str}{age_str}")
        
        lines.append("")
    
    # Also add contacts who came today but aren't in utm_visitors yet
    contact_emails = set(v.get('customer_email','').lower() for v in visitors if v.get('customer_email'))
    new_contacts = [c for c in contacts if c['email'].lower() not in contact_emails and c.get('utm_content')]
    
    if new_contacts:
        lines.append("**Other new leads (from form submissions):**")
        for c in new_contacts:
            paid_str = " ✅ PAID" if c.get('paid_299') else ""
            lines.append(f"  → {c.get('first_name','')} ({c['email']}) | Ad: {c.get('utm_content','?')}{paid_str}")
    
    report = "\n".join(lines)
    print(report)
    return report

if __name__ == "__main__":
    main()
