import React from "react";
import {Metadata} from "next";
import {AppRouterCacheProvider} from '@mui/material-nextjs/v15-appRouter';
import "./globals.css";
import {Roboto} from 'next/font/google';
import {ThemeProvider} from '@mui/material/styles';
import theme from '../theme'

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-roboto',
})

export const metadata: Metadata = {
    title: 'Akai Sampler App',
    description: 'A set of experimental tools for the Akai S5000/S6000 series samplers.',
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
        <body className={`${roboto.variable} bg-white text-neutral-800`}>
        <AppRouterCacheProvider>
            <ThemeProvider theme={theme}>
                <div id="root">{children}</div>
            </ThemeProvider>
        </AppRouterCacheProvider>
        </body>
        </html>
    )
}