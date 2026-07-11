export function maskPhone(phone: string | null | undefined): string {
    if (!phone) return 'unknown';
    // strips non-digits, masks all but last 4
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return digits.slice(-4).padStart(digits.length, '*');
}

export function maskEmail(email: string | null | undefined): string {
    if (!email || !email.includes('@')) return 'unknown';
    const [name, domain] = email.split('@');
    const safeName = name.slice(0, 2).padEnd(name.length, '*');
    return `${safeName}@${domain}`;
}
