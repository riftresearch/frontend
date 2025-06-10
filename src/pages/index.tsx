import { GoHomeFill } from 'react-icons/go';
import useWindowSize from '../hooks/useWindowSize';
import { useRouter } from 'next/router';
import { Flex, Spacer, Text, Box, Spinner, Button } from '@chakra-ui/react';
import { Navbar } from '../components/nav/Navbar';
import { colors } from '../utils/colors';
import { OpenGraph } from '../components/background/OpenGraph';
import { FONT_FAMILIES } from '../utils/font';
import BlueText from '../components/other/BlueText';
import OrangeText from '../components/other/OrangeText';
import React, { useEffect, useCallback, useState } from 'react';
import { useStore } from '../store';
import { SwapContainer } from '../components/swap/SwapContainer';
import { DepositUI } from '../components/deposit/DepositUI';
import { ReserveLiquidityContainer } from '../components/swap/ReserveLiquidityContainer';
import CurrencyModal from '../components/swap/CurrencyModal';
import OfflinePage from '../components/background/OfflinePage';
import { opaqueBackgroundColor } from '../utils/constants';
import { SwapAmounts } from '../components/swap/SwapAmounts';
import { AssetTag } from '../components/other/AssetTag';
import { MdArrowRight } from 'react-icons/md';
import { DummySwapAmounts } from '../components/other/DummySwapAmoutns';
import Particles from 'react-tsparticles';
import { loadSlim } from 'tsparticles-slim';
import type { Engine } from 'tsparticles-engine';
import { useRive, Layout, Fit, Alignment, useStateMachineInput } from '@rive-app/react-canvas';
import { IoIosCheckmarkCircle } from 'react-icons/io';
import { BsCheckCircleFill } from 'react-icons/bs';
import { LuCopy } from 'react-icons/lu';
import { BTC_Logo } from '../components/other/SVGs';
import { HiOutlineExternalLink, HiOutlineHome } from 'react-icons/hi';
import { useToast } from '@chakra-ui/react';
import { copyToClipboard } from '../utils/frontendHelpers';

const Home = () => {
    const { isTablet, isMobile } = useWindowSize();
    const router = useRouter();
    const handleNavigation = (route: string) => {
        router.push(route);
    };

    const swapFlowState = useStore((state) => state.swapFlowState);
    const depositFlowState = useStore((state) => state.depositFlowState);
    const setSwapFlowState = useStore((state) => state.setSwapFlowState);
    const setDepositFlowState = useStore((state) => state.setDepositFlowState);
    const btcInputSwapAmount = useStore((state) => state.btcInputSwapAmount);
    const setBtcInputSwapAmount = useStore((state) => state.setBtcInputSwapAmount);
    const coinbaseBtcDepositAmount = useStore((state) => state.coinbaseBtcDepositAmount);
    const setCoinbaseBtcDepositAmount = useStore((state) => state.setCoinbaseBtcDepositAmount);
    const btcOutputAmount = useStore((state) => state.btcOutputAmount);
    const setBtcOutputAmount = useStore((state) => state.setBtcOutputAmount);
    const depositMode = useStore((state) => state.depositMode);
    const { isLaptop, isSmallMobile, windowSize, isLargeDesktop } = useWindowSize();

    // Rift Developer Mode
    const riftDeveloperMode = useStore((state) => state.riftDeveloperMode);
    const setRiftDeveloperMode = useStore((state) => state.setRiftDeveloperMode);

    const [auctionStep, setAuctionStep] = useState(0);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean }>({
        x: 0,
        y: 0,
        show: false,
    });

    const animationURL = '/rift.riv';
    const { rive, RiveComponent } = useRive({
        src: animationURL,
        stateMachines: 'State Machine 1',
        layout: new Layout({
            fit: Fit.Cover,
            alignment: Alignment.Center,
        }),
        autoplay: true,
    });

    const orangeButtonURL = '/orange_button.riv';
    const { rive: orangeButtonRive, RiveComponent: OrangeButtonRiveComponent } = useRive({
        src: orangeButtonURL,
        stateMachines: 'State Machine 1',
        layout: new Layout({
            fit: Fit.Contain,
            alignment: Alignment.Center,
        }),
        autoplay: true,
    });

    useEffect(() => {
        setSwapFlowState('0-not-started');
        // setDepositFlowState('0-not-started');
        setCoinbaseBtcDepositAmount('');
        setBtcInputSwapAmount('');
        setBtcOutputAmount('');
    }, []);

    useEffect(() => {
        if (depositFlowState === '1-finding-liquidity') {
            const auctionSteps = [
                'initializing market maker auction...',
                'broadcasting request to liquidity providers...',
                'collecting price quotes...',
                'comparing rates across providers...',
                'finalizing optimal execution path...',
            ];

            const interval = setInterval(() => {
                setAuctionStep((prev) => (prev + 1) % auctionSteps.length);
            }, 3000);

            return () => clearInterval(interval);
        }
    }, [depositFlowState]);

    // Handle right-click context menu
    const handleContextMenu = (e: React.MouseEvent) => {
        // Only show context menu on localhost
        if (
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '0.0.0.0')
        ) {
            e.preventDefault();
            setContextMenu({
                x: e.pageX,
                y: e.pageY,
                show: true,
            });
        }
    };

    const handleClickOutside = () => {
        setContextMenu((prev) => ({ ...prev, show: false }));
    };

    const toggleDeveloperMode = () => {
        setRiftDeveloperMode(!riftDeveloperMode);
        setContextMenu((prev) => ({ ...prev, show: false }));
    };

    // Add event listeners for context menu
    useEffect(() => {
        const handleClick = () => handleClickOutside();
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClickOutside();
            }
        };

        if (contextMenu.show) {
            document.addEventListener('click', handleClick);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [contextMenu.show]);

    const particlesInit = useCallback(async (engine: Engine) => {
        await loadSlim(engine);
    }, []);

    const RiftSVG = () => {
        return (
            <svg
                width={isTablet ? '70' : '220'}
                height={isTablet ? '30' : '48'}
                viewBox='0 0 3190 674'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'>
                <path
                    d='M362.16 0.509766L708.992 1.01953C764.583 1.01988 854.441 35.3784 899.254 66.0684C946.209 98.2244 976.303 137.703 991.728 187.377C998.545 209.335 999.065 270.158 992.616 291.358C977.097 342.374 948.466 381.798 903.368 414.254C880.445 430.753 849.028 447.137 821.983 456.698C811.159 460.525 802.305 464.051 802.305 464.535C802.324 465.034 855.943 511.837 921.476 568.554C987.014 625.277 1040.64 672.038 1040.65 672.471C1040.65 672.896 989.297 673.212 926.534 673.17L812.423 673.096L709.3 578.507L606.177 483.921H326.44L231.556 373.886H462.542C577.817 373.886 657.812 373.229 672.215 372.168C764.603 365.355 822.541 317.06 822.541 246.859C822.541 191.068 785.958 148.878 721.28 130.076C691.254 121.348 696.678 121.509 432.987 121.479L188.463 121.451V673.246H0.960938V58.8457C0.960938 26.3598 27.3199 0.0372334 59.8057 0.0830078L362.16 0.509766ZM1358.4 673.242H1171.9V0H1358.4V673.242ZM2215.9 134.838H1680.88V269.92H2094.76L1997.96 382.709H1680.88V673.242H1493.72V67.4189C1493.72 48.8748 1502.88 33.0017 1521.21 19.8008C1539.53 6.60022 1561.56 5.19057e-05 1587.3 0H2337.08L2215.9 134.838ZM3189.12 134.834H2869.77V673.242H2697.47V134.834H2363.92L2485.05 0H3189.12V134.834Z'
                    fill='white'
                />
            </svg>
        );
    };

    return (
        <>
            <OpenGraph />
            {/* <OfflinePage> */}
            <Flex
                h='100vh'
                width='100%'
                direction='column'
                backgroundImage={'/images/rift_background_low.webp'}
                backgroundSize='cover'
                backgroundPosition='center'>
                <Navbar />
                <Flex
                    direction={'column'}
                    align='center'
                    w='100%'
                    mt={swapFlowState === '0-not-started' ? '15vh' : '100px'}>
                    {depositFlowState === '0-not-started' && (
                        // 0 - MAIN SWAP UI
                        <>
                            <Flex mt='15px'></Flex>
                            <RiftSVG />

                            <Flex
                                flexDir={'column'}
                                textAlign={'center'}
                                userSelect={'none'}
                                fontSize={isTablet ? '12px' : '15px'}
                                mt={'18px'}
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={'#c3c3c3'}
                                cursor={'default'}
                                fontWeight={'normal'}
                                gap={'0px'}>
                                <Text mt='15px'>
                                    The first trustless <OrangeText>Bitcoin</OrangeText> exchange. See{' '}
                                    <Box
                                        as='span'
                                        // go to https://rift.exchange
                                        onClick={() => (window.location.href = 'https://rift.exchange')}
                                        style={{
                                            textDecoration: 'underline',
                                            cursor: 'pointer !important',
                                        }}
                                        fontWeight={'bold'}>
                                        how it works
                                    </Box>
                                </Text>
                            </Flex>
                            <SwapContainer />
                        </>
                    )}
                    {depositFlowState === '1-finding-liquidity' && (
                        // 1 - FINDING LIQUIDITY UI
                        <>
                            {/* <Flex mt='20px'></Flex> */}
                            <DummySwapAmounts />
                            <Flex
                                direction='column'
                                align='center'
                                mt={'30px'}
                                w={isMobile ? '100%' : '950px'}
                                h='480px'
                                borderRadius='40px'
                                boxShadow='0px -1px 33.5px rgba(255, 160, 76, 0.46)'
                                {...opaqueBackgroundColor}
                                borderBottom={'2px solid #FFA04C'}
                                borderLeft={'2px solid #FFA04C'}
                                borderTop={'2px solid #FFA04C'}
                                borderRight={'2px solid #FFA04C'}
                                position='relative'
                                justifyContent={'center'}
                                overflow='hidden'>
                                <Flex w='90%' direction={'column'} alignItems={'center'} zIndex='1'>
                                    <Text
                                        fontSize={'12px'}
                                        color={'#aaa'}
                                        fontFamily={FONT_FAMILIES.AUX_MONO}
                                        fontWeight={'normal'}
                                        letterSpacing={'-1.5px'}
                                        textShadow='0px 2px 4px rgba(0, 0, 0, 0.7)'>
                                        ~ 20 seconds remaining
                                    </Text>

                                    <Flex align='center' justify='center'>
                                        <Spinner
                                            color='#FFA04C'
                                            width='16px'
                                            height='16px'
                                            borderRadius={'200px'}
                                            thickness='3px'
                                            mr='10px'
                                            mt='-2px'
                                            speed='0.85s'
                                            position='relative'
                                            zIndex='1'
                                        />
                                        <Text
                                            fontSize={'32px'}
                                            color={'#fff'}
                                            fontWeight={'bold'}
                                            fontFamily={FONT_FAMILIES.NOSTROMO}
                                            textShadow='0px 0px 4px rgba(150, 150, 150, 0.8)'>
                                            SEARCHING FOR the best price...
                                        </Text>
                                    </Flex>
                                    <Text
                                        fontSize={'12px'}
                                        color={'#aaa'}
                                        fontFamily={FONT_FAMILIES.AUX_MONO}
                                        fontWeight={'normal'}
                                        letterSpacing={'-1px'}
                                        textShadow='0px 2px 4px rgba(0, 0, 0, 0.7)'>
                                        {auctionStep === 0 && 'initializing market maker auction...'}
                                        {auctionStep === 1 && 'broadcasting request to liquidity providers...'}
                                        {auctionStep === 2 && 'collecting price quotes...'}
                                        {auctionStep === 3 && 'comparing rates across providers...'}
                                        {auctionStep === 4 && 'finalizing optimal execution path...'}
                                    </Text>
                                </Flex>
                                <Particles
                                    id='tsparticles'
                                    init={particlesInit}
                                    options={{
                                        background: {
                                            color: {
                                                value: 'transparent',
                                            },
                                        },
                                        fpsLimit: 120,
                                        particles: {
                                            color: {
                                                value: '#FFA04C',
                                            },
                                            links: {
                                                color: '#FFA04C',
                                                distance: 150,
                                                enable: true,
                                                opacity: 0.8,
                                                width: 1,
                                            },
                                            move: {
                                                direction: 'none',
                                                enable: true,
                                                outModes: {
                                                    default: 'bounce',
                                                },
                                                random: false,
                                                speed: 3,
                                                straight: false,
                                            },
                                            number: {
                                                density: {
                                                    enable: true,
                                                    area: 700,
                                                },
                                                value: 80,
                                            },
                                            opacity: {
                                                value: 0.8,
                                            },
                                            shape: {
                                                type: 'circle',
                                            },
                                            size: {
                                                value: { min: 0.8, max: 6 },
                                            },
                                        },
                                        interactivity: {
                                            detect_on: 'window',
                                            events: {
                                                onhover: {
                                                    enable: true,
                                                    mode: 'grab',
                                                },
                                                onclick: {
                                                    enable: true,
                                                    mode: 'push',
                                                },
                                                resize: true,
                                            },
                                            modes: {
                                                grab: {
                                                    distance: 200,
                                                    line_linked: {
                                                        opacity: 1,
                                                    },
                                                },
                                                bubble: {
                                                    distance: 400,
                                                    size: 40,
                                                    duration: 2,
                                                    opacity: 8,
                                                    speed: 3,
                                                },
                                                push: {
                                                    particles_nb: 4,
                                                },
                                                remove: {
                                                    particles_nb: 2,
                                                },
                                            },
                                        },
                                        detectRetina: true,
                                    }}
                                    style={{
                                        position: 'absolute',
                                        zIndex: -1,
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                    }}
                                />
                            </Flex>
                        </>
                    )}
                    {depositFlowState === '2-awaiting-payment' && (
                        // 2 - AWAITING PAYMENT UI
                        <>
                            <DummySwapAmounts />
                            <Flex
                                direction='column'
                                align='center'
                                mt={'30px'}
                                py={isMobile ? '20px' : '27px'}
                                w={isMobile ? '100%' : '950px'}
                                h='480px'
                                borderRadius='40px'
                                boxShadow='0px -1px 33.5px rgba(255, 160, 76, 0.46)'
                                bg={'#000'}
                                overflow={'hidden'}
                                borderBottom={'2px solid #FFA04C'}
                                borderLeft={'2px solid #FFA04C'}
                                borderTop={'2px solid #FFA04C'}
                                borderRight={'2px solid #FFA04C'}>
                                <Flex
                                    w='100%'
                                    h='100%'
                                    mt='-80px'
                                    justifyContent={'center'}
                                    alignItems={'center'}
                                    overflow={'clip'}>
                                    <RiveComponent />
                                </Flex>
                                <Flex w='90%' direction={'column'} alignItems={'center'} mt='-20px' zIndex='1'>
                                    <Text
                                        fontSize={'12px'}
                                        color={'#aaa'}
                                        fontFamily={FONT_FAMILIES.AUX_MONO}
                                        fontWeight={'normal'}
                                        letterSpacing={'-1.5px'}
                                        textShadow='0px 2px 4px rgba(0, 0, 0, 0.7)'>
                                        ~ 10 seconds remaining
                                    </Text>

                                    <Flex align='center' justify='center'>
                                        {/* <Spinner color='#FFA04C' width='16px' height='16px' borderRadius={'200px'} thickness='3px' mr='10px' mt='-2px' speed='0.85s' position='relative' zIndex='1' /> */}
                                        <Text
                                            fontSize={'30px'}
                                            color={'#fff'}
                                            fontWeight={'bold'}
                                            fontFamily={FONT_FAMILIES.NOSTROMO}
                                            textShadow='0px 0px 4px rgba(150, 150, 150, 0.8)'>
                                            TRANSFERRING ASSETS TO YOUR WALLET...
                                        </Text>
                                    </Flex>
                                    <Text
                                        fontSize={'12px'}
                                        color={'#aaa'}
                                        fontFamily={FONT_FAMILIES.AUX_MONO}
                                        fontWeight={'normal'}
                                        letterSpacing={'-1px'}
                                        textShadow='0px 2px 4px rgba(0, 0, 0, 0.7)'>
                                        We found you the best price! Assets are being transferred to your wallet...
                                    </Text>
                                </Flex>
                            </Flex>
                        </>
                    )}
                    {depositFlowState === '3-payment-recieved' && (
                        // 3 - PAYMENT RECIEVED UI
                        <>
                            <DummySwapAmounts />
                            <Flex
                                direction='column'
                                align='center'
                                mt={'30px'}
                                py={isMobile ? '20px' : '27px'}
                                w={isMobile ? '100%' : '950px'}
                                h='480px'
                                borderRadius='40px'
                                boxShadow='0px -1px 33.5px rgba(255, 160, 76, 0.46)'
                                {...opaqueBackgroundColor}
                                borderBottom={'2px solid #FFA04C'}
                                borderLeft={'2px solid #FFA04C'}
                                borderTop={'2px solid #FFA04C'}
                                borderRight={'2px solid #FFA04C'}>
                                <Flex
                                    w='80%'
                                    h='100%'
                                    ml='60px'
                                    mt='-19px'
                                    justifyContent={'center'}
                                    alignItems={'center'}
                                    position='absolute'
                                    overflow={'clip'}>
                                    <OrangeButtonRiveComponent />
                                </Flex>

                                <Flex w='90%' direction={'row'} justifyContent={'center'} alignItems={'center'}>
                                    <Flex mt='-2px' mr='10px'>
                                        <BsCheckCircleFill
                                            size={29}
                                            color={'#FFA04C'}
                                            style={{
                                                filter: 'drop-shadow(0px 0px 4.968px rgba(247, 147, 26, 0.33))',
                                                fill: 'url(#orangeGradient)',
                                            }}
                                        />
                                        <svg width='0' height='0'>
                                            <defs>
                                                <linearGradient id='orangeGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
                                                    <stop offset='0%' stopColor='#FFA74A' />
                                                    <stop offset='100%' stopColor='#EF761A' />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                    </Flex>
                                    <Text fontSize={'32px'} align={'center'}>
                                        Payment received!
                                    </Text>
                                </Flex>
                                <Flex w='70%' direction={'column'} alignItems={'center'} mt='4px' zIndex='1'>
                                    <Text
                                        fontSize={'12.25px'}
                                        color={'#aaa'}
                                        fontFamily={FONT_FAMILIES.AUX_MONO}
                                        fontWeight={'normal'}
                                        letterSpacing={'-1px'}
                                        textShadow='0px 2px 4px rgba(0, 0, 0, 0.7)'>
                                        Bitcoin has been sent to your wallet and should shortly!
                                    </Text>
                                </Flex>

                                {/* PAYMENT DETAILS */}
                                <Flex
                                    w='89%'
                                    direction={'row'}
                                    justifyContent={'space-between'}
                                    alignItems={'center'}
                                    mt='55px'
                                    gap='15px'>
                                    <Flex direction={'column'} w='100%'>
                                        <Text
                                            fontFamily={FONT_FAMILIES.NOSTROMO}
                                            fontSize={'13px'}
                                            mb='7px'
                                            fontWeight={'bold'}>
                                            Status
                                        </Text>
                                        <Button
                                            w='100%'
                                            borderRadius={'10px'}
                                            px='15px'
                                            py='19px'
                                            fontSize={'15px'}
                                            fontWeight={'normal'}
                                            justifyContent={'flex-start'}
                                            onClick={() =>
                                                window.open(
                                                    'https://mempool.space/tx/b3f89c0729bb16636af6bca2a0d0965e8b32663e9d091067e24f52a73d70e869',
                                                    '_blank',
                                                )
                                            }
                                            letterSpacing={'-1.5px'}
                                            fontFamily={FONT_FAMILIES.AUX_MONO}
                                            border='2px solid rgb(64, 170, 90)'
                                            position='relative'
                                            overflow='hidden'
                                            background='transparent'
                                            boxShadow='0px 2.595px 23.351px 3.243px rgba(59, 59, 59, 0.33)'
                                            color='rgb(235, 255, 236)'
                                            _before={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgb(4, 36, 20)',
                                                zIndex: -1,
                                                transition: 'opacity 0.3s ease',
                                            }}
                                            _hover={{
                                                _before: {
                                                    opacity: 0.7,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                            }}
                                            _active={{
                                                _before: {
                                                    opacity: 0.7,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                                background: 'transparent',
                                            }}
                                            _after={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgb(6, 46, 26)',
                                                zIndex: -1,
                                                opacity: 0,
                                                transition: 'opacity 0.3s ease',
                                            }}>
                                            <Flex
                                                alignItems={'center'}
                                                mt='-1px'
                                                mr={'8px'}
                                                position='relative'
                                                zIndex='1'>
                                                <BsCheckCircleFill size={15.5} color={'rgb(64, 170, 90)'} />
                                            </Flex>
                                            <Text mt='0.5px' position='relative' zIndex='1'>
                                                2 Confirmations
                                            </Text>
                                        </Button>
                                    </Flex>

                                    <Flex direction={'column'} w='100%'>
                                        <Text
                                            fontFamily={FONT_FAMILIES.NOSTROMO}
                                            fontSize={'13px'}
                                            mb='7px'
                                            fontWeight={'bold'}>
                                            TXN HASH
                                        </Text>
                                        <Button
                                            w='100%'
                                            borderRadius={'10px'}
                                            px='17px'
                                            py='19px'
                                            fontSize={'15px'}
                                            fontWeight={'normal'}
                                            onClick={() =>
                                                window.open(
                                                    'https://mempool.space/tx/b3f89c0729bb16636af6bca2a0d0965e8b32663e9d091067e24f52a73d70e869',
                                                    '_blank',
                                                )
                                            }
                                            letterSpacing={'-1.5px'}
                                            fontFamily={FONT_FAMILIES.AUX_MONO}
                                            border='2px solid #445BCB'
                                            position='relative'
                                            overflow='hidden'
                                            background='transparent'
                                            boxShadow='0px 2.595px 23.351px 3.243px rgba(59, 59, 59, 0.33)'
                                            color='white'
                                            _before={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(50, 66, 168, 0.30)',
                                                zIndex: -1,
                                                transition: 'opacity 0.3s ease',
                                            }}
                                            _hover={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                            }}
                                            _active={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                                background: 'transparent',
                                            }}
                                            _after={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(50, 66, 168, 0.45)',
                                                zIndex: -1,
                                                opacity: 0,
                                                transition: 'opacity 0.3s ease',
                                            }}>
                                            <Flex
                                                w='100%'
                                                justifyContent='space-between'
                                                alignItems='center'
                                                position='relative'
                                                zIndex='1'>
                                                <Text mr='10px'>0cabaa52f2c2f49b9a...40a1ddeffb9c201</Text>
                                                <Box
                                                    as='span'
                                                    cursor='pointer'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyToClipboard(
                                                            '0cabaa52f2c2f49b9a40a1ddeffb9c201',
                                                            'Transaction hash copied to clipboard!',
                                                        );
                                                    }}>
                                                    <LuCopy color='gray' />
                                                </Box>
                                            </Flex>
                                        </Button>
                                    </Flex>
                                    <Flex direction={'column'} w='100%' mt='26px'>
                                        <Button
                                            onClick={() =>
                                                window.open(
                                                    'https://mempool.space/tx/b3f89c0729bb16636af6bca2a0d0965e8b32663e9d091067e24f52a73d70e869',
                                                    '_blank',
                                                )
                                            }
                                            bg={colors.offBlackLighter}
                                            borderWidth={'2px'}
                                            borderColor={colors.borderGrayLight}
                                            borderRadius={'10px'}
                                            px='20px'
                                            py='19px'
                                            border='2px solid #445BCB'
                                            position='relative'
                                            overflow='hidden'
                                            background='transparent'
                                            boxShadow='0px 2.595px 23.351px 3.243px rgba(59, 59, 59, 0.33)'
                                            _before={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(50, 66, 168, 0.30)',
                                                zIndex: -1,
                                                transition: 'opacity 0.3s ease',
                                            }}
                                            _hover={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                                bg: 'transparent',
                                            }}
                                            _active={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                                bg: 'transparent',
                                            }}
                                            _after={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(50, 66, 168, 0.45)',
                                                zIndex: -1,
                                                opacity: 0,
                                                transition: 'opacity 0.3s ease',
                                            }}>
                                            <Flex mt='-2px ' mr='8px' position='relative' zIndex='1'>
                                                <HiOutlineExternalLink size={'16px'} color={colors.offerWhite} />
                                            </Flex>
                                            <Text
                                                fontSize='13px'
                                                color={colors.offerWhite}
                                                fontFamily={FONT_FAMILIES.NOSTROMO}
                                                cursor={'pointer'}
                                                fontWeight={'normal'}
                                                position='relative'
                                                zIndex='1'>
                                                View on Mempool
                                            </Text>
                                        </Button>
                                    </Flex>
                                </Flex>

                                <Flex
                                    w='89%'
                                    direction={'row'}
                                    justifyContent={'space-between'}
                                    alignItems={'center'}
                                    mt='25px'>
                                    <Flex direction={'column'} w='64%'>
                                        <Text
                                            fontFamily={FONT_FAMILIES.NOSTROMO}
                                            fontSize={'13px'}
                                            mb='7px'
                                            fontWeight={'bold'}>
                                            Your Address{' '}
                                        </Text>
                                        <Button
                                            w='100%'
                                            borderRadius={'10px'}
                                            px='17px'
                                            py='19px'
                                            fontSize={'15px'}
                                            onClick={() =>
                                                window.open(
                                                    'https://mempool.space/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                                                    '_blank',
                                                )
                                            }
                                            fontWeight={'normal'}
                                            letterSpacing={'-1.5px'}
                                            fontFamily={FONT_FAMILIES.AUX_MONO}
                                            border='2px solid #FF9E38'
                                            position='relative'
                                            overflow='hidden'
                                            color='white'
                                            background='transparent'
                                            boxShadow='0px 2.566px 23.096px 3.208px rgba(254, 157, 56, 0.29)'
                                            backdropFilter='blur(32.00636672973633px)'
                                            _before={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background:
                                                    'linear-gradient(0deg, rgba(242, 119, 31, 0.16) 0%, rgba(111, 44, 15, 0.12) 100%)',
                                                zIndex: -1,
                                                transition: 'opacity 0.3s ease',
                                            }}
                                            _hover={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                            }}
                                            _active={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                                background: 'transparent',
                                            }}
                                            _after={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background:
                                                    'linear-gradient(0deg, rgba(242, 119, 31, 0.25) 0%, rgba(111, 44, 15, 0.2) 100%)',
                                                zIndex: -1,
                                                opacity: 0,
                                                transition: 'opacity 0.3s ease',
                                            }}>
                                            <Flex
                                                w='100%'
                                                justifyContent='space-between'
                                                alignItems='center'
                                                position='relative'
                                                zIndex='1'>
                                                <Text>bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</Text>
                                                <Text
                                                    ml='-35px'
                                                    fontFamily={FONT_FAMILIES.AUX_MONO}
                                                    fontSize={'13px'}
                                                    fontWeight={'normal'}
                                                    color={'#999'}>
                                                    P2PKSH
                                                </Text>
                                                <Box
                                                    as='span'
                                                    cursor='pointer'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyToClipboard(
                                                            'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                                                            'Bitcoin address copied to clipboard',
                                                        );
                                                    }}>
                                                    <LuCopy color='gray' />
                                                </Box>
                                            </Flex>
                                        </Button>
                                    </Flex>
                                    <Flex direction={'column'} w='33.5%'>
                                        <Text
                                            fontFamily={FONT_FAMILIES.NOSTROMO}
                                            fontSize={'13px'}
                                            mb='7px'
                                            fontWeight={'bold'}>
                                            BALANCE
                                        </Text>

                                        <Button
                                            w='100%'
                                            borderRadius={'10px'}
                                            px='17px'
                                            py='19px'
                                            fontSize={'15px'}
                                            fontWeight={'normal'}
                                            letterSpacing={'-1.5px'}
                                            fontFamily={FONT_FAMILIES.AUX_MONO}
                                            border='2px solid #FF9E38'
                                            position='relative'
                                            overflow='hidden'
                                            background='transparent'
                                            color='white'
                                            onClick={() =>
                                                window.open(
                                                    'https://mempool.space/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                                                    '_blank',
                                                )
                                            }
                                            boxShadow='0px 2.566px 23.096px 3.208px rgba(254, 157, 56, 0.29)'
                                            backdropFilter='blur(32.00636672973633px)'
                                            _before={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background:
                                                    'linear-gradient(0deg, rgba(242, 119, 31, 0.16) 0%, rgba(111, 44, 15, 0.12) 100%)',
                                                zIndex: -1,
                                                transition: 'opacity 0.3s ease',
                                            }}
                                            _hover={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                            }}
                                            _active={{
                                                _before: {
                                                    opacity: 0,
                                                },
                                                _after: {
                                                    opacity: 1,
                                                },
                                                background: 'transparent',
                                            }}
                                            _after={{
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background:
                                                    'linear-gradient(0deg, rgba(242, 119, 31, 0.25) 0%, rgba(111, 44, 15, 0.2) 100%)',
                                                zIndex: -1,
                                                opacity: 0,
                                                transition: 'opacity 0.3s ease',
                                            }}>
                                            <Flex w='100%' alignItems='center' position='relative' zIndex='1'>
                                                <BTC_Logo width={'19px'} height={'19px'} />
                                                <Text
                                                    ml='8px'
                                                    letterSpacing={'-1.5px'}
                                                    fontFamily={FONT_FAMILIES.AUX_MONO}
                                                    fontSize={'16px'}
                                                    fontWeight={'normal'}>
                                                    1.20240252
                                                </Text>
                                                <Spacer />
                                                <Text
                                                    ml='15px'
                                                    fontFamily={FONT_FAMILIES.AUX_MONO}
                                                    fontSize={'13px'}
                                                    fontWeight={'normal'}
                                                    color={'#999'}>
                                                    $121,355.63
                                                </Text>
                                            </Flex>
                                        </Button>
                                    </Flex>
                                </Flex>
                                <Flex mt='75px' gap='10px' direction={'column'} alignItems={'center'}>
                                    {/* <Text fontSize='9px' mb='5px' color={'#aaa'} fontFamily={FONT_FAMILIES.AUX_MONO} cursor={'pointer'} fontWeight={'normal'} position='relative' zIndex='1'>
                                        damn that was easy!
                                    </Text> */}
                                    <Button
                                        borderRadius='12px'
                                        h='40px'
                                        onClick={() => setDepositFlowState('0-not-started')}
                                        px='45px'
                                        border='2px solid #FF9E38'
                                        position='relative'
                                        overflow='hidden'
                                        background='transparent'
                                        boxShadow='0px 2.3px 20.7px 2.875px rgba(254, 157, 56, 0.38)'
                                        backdropFilter='blur(28.685392379760742px)'
                                        _before={{
                                            content: '""',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            background:
                                                'linear-gradient(0deg, rgba(255, 80, 2, 0.35) 0%, rgba(111, 44, 15, 0.12) 100%)',
                                            zIndex: -1,
                                            transition: 'opacity 0.3s ease',
                                        }}
                                        _hover={{
                                            _before: {
                                                opacity: 0,
                                            },
                                            _after: {
                                                opacity: 1,
                                            },
                                        }}
                                        _active={{
                                            _before: {
                                                opacity: 0,
                                            },
                                            _after: {
                                                opacity: 1,
                                            },
                                            background: 'transparent',
                                        }}
                                        _after={{
                                            content: '""',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            background:
                                                'linear-gradient(0deg, rgba(255, 80, 2, 0.45) 0%, rgba(111, 44, 15, 0.2) 100%)',
                                            zIndex: -1,
                                            opacity: 0,
                                            transition: 'opacity 0.3s ease',
                                        }}>
                                        <Flex mt='-1px' mr='6px' position='relative' zIndex='1'>
                                            <GoHomeFill size={'15px'} color={colors.offerWhite} />
                                        </Flex>
                                        <Text
                                            fontSize='14px'
                                            color={colors.offerWhite}
                                            fontFamily={FONT_FAMILIES.NOSTROMO}
                                            cursor={'pointer'}
                                            fontWeight={'normal'}
                                            position='relative'
                                            zIndex='1'>
                                            HOME
                                        </Text>
                                    </Button>
                                </Flex>
                            </Flex>
                        </>
                    )}
                </Flex>
                <CurrencyModal />

                {/* Custom Context Menu */}
                {contextMenu.show && (
                    <Box
                        position='fixed'
                        top={`${contextMenu.y}px`}
                        left={`${contextMenu.x}px`}
                        bg='rgba(0, 0, 0, 0.9)'
                        borderRadius='md'
                        boxShadow='0px 4px 12px rgba(0, 0, 0, 0.3)'
                        zIndex={10000}
                        border='1px solid #333'
                        overflow='hidden'>
                        <Button
                            w='200px'
                            h='40px'
                            bg='transparent'
                            border='none'
                            color='white'
                            fontSize='sm'
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            _hover={{ bg: 'rgba(255, 160, 76, 0.1)' }}
                            _active={{ bg: 'rgba(255, 160, 76, 0.2)' }}
                            justifyContent='flex-start'
                            pl={4}
                            borderRadius='none'
                            onClick={toggleDeveloperMode}>
                            {riftDeveloperMode ? '🔧 Disable' : '🔧 Enable'} Rift Developer Mode
                        </Button>
                    </Box>
                )}
            </Flex>
            {/* </OfflinePage> */}
        </>
    );
};

export default Home;
