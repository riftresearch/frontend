// import React, { useEffect, useCallback, useState } from "react";
// import { GetServerSideProps } from "next";
// import { Flex, Text, Box, Spinner, Button } from "@chakra-ui/react";
// import { Navbar } from "@/components/nav/Navbar";
// import { colors } from "@/utils/colors";
// import { FONT_FAMILIES } from "@/utils/font";
// import { opaqueBackgroundColor } from "@/utils/constants";
// import useWindowSize from "@/hooks/useWindowSize";
// import { useSwapStatus } from "@/hooks/useSwapStatus";
// import { useRive, Layout, Fit, Alignment } from "@rive-app/react-canvas";
// import Particles from "react-tsparticles";
// import { loadSlim } from "tsparticles-slim";
// import { BsCheckCircleFill } from "react-icons/bs";
// import { LuCopy } from "react-icons/lu";
// import { HiOutlineExternalLink, HiOutlineHome } from "react-icons/hi";
// import { GoHomeFill } from "react-icons/go";
// import { DummySwapAmounts } from "@/components/other/DummySwapAmounts";

// interface SwapSuccessPageProps {
//   txHash: string;
//   chainId: number;
// }

// const SwapSuccessPage: React.FC<SwapSuccessPageProps> = ({
//   txHash,
//   chainId,
// }) => {
//   const { isMobile } = useWindowSize();
//   const { state, receipt, validateTxHash, auctionIndex, otcSwap, auction } =
//     useSwapStatus({
//       txHash: txHash as `0x${string}`,
//       chainId,
//     });

//   const [auctionStep, setAuctionStep] = useState(0);

//   // Simple copy to clipboard function
//   const copyToClipboard = (text: string, successMessage: string) => {
//     navigator.clipboard
//       .writeText(text)
//       .then(() => {
//         console.log(successMessage);
//         // You could replace this with a toast notification if needed
//       })
//       .catch((err) => {
//         console.error("Failed to copy: ", err);
//       });
//   };

//   // Setup Rive animations
//   const animationURL = "/rift.riv";
//   const { rive, RiveComponent } = useRive({
//     src: animationURL,
//     stateMachines: "State Machine 1",
//     layout: new Layout({
//       fit: Fit.Cover,
//       alignment: Alignment.Center,
//     }),
//     autoplay: true,
//   });

//   const orangeButtonURL = "/orange_button.riv";
//   const { rive: orangeButtonRive, RiveComponent: OrangeButtonRiveComponent } =
//     useRive({
//       src: orangeButtonURL,
//       stateMachines: "State Machine 1",
//       layout: new Layout({
//         fit: Fit.Contain,
//         alignment: Alignment.Center,
//       }),
//       autoplay: true,
//     });

//   // Particles initialization
//   const particlesInit = useCallback(async (engine: any) => {
//     await loadSlim(engine);
//   }, []);

//   // Auction step animation for finding liquidity
//   useEffect(() => {
//     if (isFindingLiquidityState(state.status)) {
//       const auctionSteps = [
//         "initializing market maker auction...",
//         "broadcasting request to liquidity providers...",
//         "collecting price quotes...",
//         "comparing rates across providers...",
//         "finalizing optimal execution path...",
//       ];

//       const interval = setInterval(() => {
//         setAuctionStep((prev) => (prev + 1) % auctionSteps.length);
//       }, 3000);

//       return () => clearInterval(interval);
//     }
//   }, [state.status]);

//   // Helper function to determine if we should show finding liquidity animation
//   const isFindingLiquidityState = (status: string) => {
//     return ["validating_tx", "tx_pending", "auction_created"].includes(status);
//   };

//   // Helper function to determine if we should show awaiting payment animation
//   const isAwaitingPaymentState = (status: string) => {
//     return status === "order_created";
//   };

//   // Helper function to determine if we should show payment received animation
//   const isPaymentReceivedState = (status: string) => {
//     return [
//       "order_settled",
//       "payment_observed_on_bitcoin",
//       "payment_proof_submitted",
//     ].includes(status);
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case "invalid_tx":
//       case "tx_not_found":
//       case "tx_failed":
//       case "auction_expired":
//       case "auction_refunded":
//       case "order_refunded":
//         return colors.red;
//       case "auction_created":
//       case "order_created":
//       case "order_settled":
//         return colors.greenOutline;
//       default:
//         return colors.offWhite;
//     }
//   };

//   const getStatusTitle = (status: string) => {
//     switch (status) {
//       case "validating_tx":
//         return "Validating Transaction...";
//       case "invalid_tx":
//         return "Invalid Transaction";
//       case "tx_not_found":
//         return "Transaction Not Found";
//       case "tx_pending":
//         return "Transaction Pending...";
//       case "tx_failed":
//         return "Transaction Failed";
//       case "auction_created":
//         return "Searching for the best price...";
//       case "auction_expired":
//         return "Auction Expired";
//       case "auction_refunded":
//         return "Auction Refunded";
//       case "order_created":
//         return "Transferring assets to your wallet...";
//       case "order_settled":
//         return "Payment received!";
//       case "order_refunded":
//         return "Order Refunded";
//       case "payment_observed_on_bitcoin":
//         return "Payment Observed";
//       case "payment_proof_submitted":
//         return "Payment Proof Submitted";
//       default:
//         return "Swap Status";
//     }
//   };

//   const getStatusMessage = (status: string, error: string | null) => {
//     if (error) return error;

//     switch (status) {
//       case "validating_tx":
//         return "Checking transaction status...";
//       case "tx_pending":
//         return "Your transaction is being processed...";
//       case "auction_created":
//         return "Your auction has been created and is waiting to be filled!";
//       case "order_created":
//         return "We found you the best price! Assets are being transferred to your wallet...";
//       case "order_settled":
//         return "Bitcoin has been sent to your wallet and should arrive shortly!";
//       case "order_refunded":
//         return "Your order has been refunded.";
//       case "payment_observed_on_bitcoin":
//         return "Bitcoin payment detected on chain";
//       case "payment_proof_submitted":
//         return "Payment proof submitted, challenge period active";
//       default:
//         return "Checking swap status...";
//     }
//   };

//   const getAuctionStepMessage = () => {
//     const messages = [
//       "initializing market maker auction...",
//       "broadcasting request to liquidity providers...",
//       "collecting price quotes...",
//       "comparing rates across providers...",
//       "finalizing optimal execution path...",
//     ];
//     return messages[auctionStep];
//   };

//   // Validate on mount
//   useEffect(() => {
//     validateTxHash();
//   }, [validateTxHash]);

//   const actualBorderColor = "#323232";
//   const borderColor = `2px solid ${actualBorderColor}`;

//   return (
//     <Flex
//       minHeight="100vh"
//       width="100%"
//       backgroundImage="url('/images/rift_background_low.webp')"
//       backgroundSize="cover"
//       backgroundPosition="center"
//       direction="column"
//       fontFamily={FONT_FAMILIES.AUX_MONO}
//     >
//       <Navbar />

//       <Flex
//         flex={1}
//         align="center"
//         justify="center"
//         py={isMobile ? "20px" : "40px"}
//         px={isMobile ? "20px" : "40px"}
//       >
//         {/* FINDING LIQUIDITY STATE */}
//         {isFindingLiquidityState(state.status) && (
//           <Flex direction="column" align="center" w="100%">
//             <DummySwapAmounts />
//             <Flex
//               direction="column"
//               align="center"
//               mt="30px"
//               w={isMobile ? "100%" : "950px"}
//               h="480px"
//               borderRadius="40px"
//               boxShadow="0px -1px 33.5px rgba(255, 160, 76, 0.46)"
//               {...opaqueBackgroundColor}
//               borderBottom="2px solid #FFA04C"
//               borderLeft="2px solid #FFA04C"
//               borderTop="2px solid #FFA04C"
//               borderRight="2px solid #FFA04C"
//               position="relative"
//               justifyContent="center"
//               overflow="hidden"
//             >
//               <Flex w="90%" direction="column" alignItems="center" zIndex="1">
//                 <Text
//                   fontSize="12px"
//                   color="#aaa"
//                   fontFamily={FONT_FAMILIES.AUX_MONO}
//                   fontWeight="normal"
//                   letterSpacing="-1.5px"
//                   textShadow="0px 2px 4px rgba(0, 0, 0, 0.7)"
//                 >
//                   ~ 20 seconds remaining
//                 </Text>

//                 <Flex align="center" justify="center">
//                   <Spinner
//                     color="#FFA04C"
//                     width="16px"
//                     height="16px"
//                     mr="10px"
//                     mt="-2px"
//                     position="relative"
//                     zIndex="1"
//                   />
//                   <Text
//                     fontSize="32px"
//                     color="#fff"
//                     fontWeight="bold"
//                     fontFamily={FONT_FAMILIES.NOSTROMO}
//                     textShadow="0px 0px 4px rgba(150, 150, 150, 0.8)"
//                   >
//                     {getStatusTitle(state.status).toUpperCase()}
//                   </Text>
//                 </Flex>
//                 <Text
//                   fontSize="12px"
//                   color="#aaa"
//                   fontFamily={FONT_FAMILIES.AUX_MONO}
//                   fontWeight="normal"
//                   letterSpacing="-1px"
//                   textShadow="0px 2px 4px rgba(0, 0, 0, 0.7)"
//                 >
//                   {state.status === "auction_created"
//                     ? getAuctionStepMessage()
//                     : getStatusMessage(state.status, state.error)}
//                 </Text>
//               </Flex>
//               <Particles
//                 id="tsparticles"
//                 init={particlesInit}
//                 options={{
//                   background: {
//                     color: {
//                       value: "transparent",
//                     },
//                   },
//                   fpsLimit: 120,
//                   particles: {
//                     color: {
//                       value: "#FFA04C",
//                     },
//                     links: {
//                       color: "#FFA04C",
//                       distance: 150,
//                       enable: true,
//                       opacity: 0.8,
//                       width: 1,
//                     },
//                     move: {
//                       direction: "none",
//                       enable: true,
//                       outModes: {
//                         default: "bounce",
//                       },
//                       random: false,
//                       speed: 3,
//                       straight: false,
//                     },
//                     number: {
//                       density: {
//                         enable: true,
//                         area: 700,
//                       },
//                       value: 80,
//                     },
//                     opacity: {
//                       value: 0.8,
//                     },
//                     shape: {
//                       type: "circle",
//                     },
//                     size: {
//                       value: { min: 0.8, max: 6 },
//                     },
//                   },
//                   interactivity: {
//                     detect_on: "window",
//                     events: {
//                       onhover: {
//                         enable: true,
//                         mode: "grab",
//                       },
//                       onclick: {
//                         enable: true,
//                         mode: "push",
//                       },
//                       resize: true,
//                     },
//                     modes: {
//                       grab: {
//                         distance: 200,
//                         line_linked: {
//                           opacity: 1,
//                         },
//                       },
//                       bubble: {
//                         distance: 400,
//                         size: 40,
//                         duration: 2,
//                         opacity: 8,
//                         speed: 3,
//                       },
//                       push: {
//                         particles_nb: 4,
//                       },
//                       remove: {
//                         particles_nb: 2,
//                       },
//                     },
//                   },
//                   detectRetina: true,
//                 }}
//                 style={{
//                   position: "absolute",
//                   zIndex: -1,
//                   top: 0,
//                   left: 0,
//                   width: "100%",
//                   height: "100%",
//                 }}
//               />
//             </Flex>

//             {/* DEBUG TEXT */}
//             <Text
//               fontSize="12px"
//               fontFamily={FONT_FAMILIES.AUX_MONO}
//               color={colors.red}
//               mt="15px"
//               textAlign="center"
//             >
//               DEBUG - FINDING LIQUIDITY: Current Status = "{state.status}"
//             </Text>
//           </Flex>
//         )}

//         {/* AWAITING PAYMENT STATE */}
//         {isAwaitingPaymentState(state.status) && (
//           <Flex direction="column" align="center" w="100%">
//             <DummySwapAmounts />
//             <Flex
//               direction="column"
//               align="center"
//               mt="30px"
//               py={isMobile ? "20px" : "27px"}
//               w={isMobile ? "100%" : "950px"}
//               h="480px"
//               borderRadius="40px"
//               boxShadow="0px -1px 33.5px rgba(255, 160, 76, 0.46)"
//               bg="#000"
//               overflow="hidden"
//               borderBottom="2px solid #FFA04C"
//               borderLeft="2px solid #FFA04C"
//               borderTop="2px solid #FFA04C"
//               borderRight="2px solid #FFA04C"
//             >
//               <Flex
//                 w="100%"
//                 h="100%"
//                 mt="-80px"
//                 justifyContent="center"
//                 alignItems="center"
//                 overflow="clip"
//               >
//                 <RiveComponent />
//               </Flex>
//               <Flex
//                 w="90%"
//                 direction="column"
//                 alignItems="center"
//                 mt="-20px"
//                 zIndex="1"
//               >
//                 <Text
//                   fontSize="12px"
//                   color="#aaa"
//                   fontFamily={FONT_FAMILIES.AUX_MONO}
//                   fontWeight="normal"
//                   letterSpacing="-1.5px"
//                   textShadow="0px 2px 4px rgba(0, 0, 0, 0.7)"
//                 >
//                   ~ 10 seconds remaining
//                 </Text>

//                 <Flex align="center" justify="center">
//                   <Text
//                     fontSize="30px"
//                     color="#fff"
//                     fontWeight="bold"
//                     fontFamily={FONT_FAMILIES.NOSTROMO}
//                     textShadow="0px 0px 4px rgba(150, 150, 150, 0.8)"
//                   >
//                     {getStatusTitle(state.status).toUpperCase()}
//                   </Text>
//                 </Flex>
//                 <Text
//                   fontSize="12px"
//                   color="#aaa"
//                   fontFamily={FONT_FAMILIES.AUX_MONO}
//                   fontWeight="normal"
//                   letterSpacing="-1px"
//                   textShadow="0px 2px 4px rgba(0, 0, 0, 0.7)"
//                 >
//                   {getStatusMessage(state.status, state.error)}
//                 </Text>
//               </Flex>
//             </Flex>

//             {/* DEBUG TEXT */}
//             <Text
//               fontSize="12px"
//               fontFamily={FONT_FAMILIES.AUX_MONO}
//               color={colors.red}
//               mt="15px"
//               textAlign="center"
//             >
//               DEBUG - AWAITING PAYMENT: Current Status = "{state.status}"
//             </Text>
//           </Flex>
//         )}

//         {/* PAYMENT RECEIVED STATE */}
//         {isPaymentReceivedState(state.status) && (
//           <Flex direction="column" align="center" w="100%">
//             <DummySwapAmounts />
//             <Flex
//               direction="column"
//               align="center"
//               mt="30px"
//               py={isMobile ? "20px" : "27px"}
//               w={isMobile ? "100%" : "950px"}
//               h="480px"
//               borderRadius="40px"
//               boxShadow="0px -1px 33.5px rgba(255, 160, 76, 0.46)"
//               {...opaqueBackgroundColor}
//               borderBottom="2px solid #FFA04C"
//               borderLeft="2px solid #FFA04C"
//               borderTop="2px solid #FFA04C"
//               borderRight="2px solid #FFA04C"
//             >
//               <Flex
//                 w="80%"
//                 h="100%"
//                 ml="60px"
//                 mt="-19px"
//                 justifyContent="center"
//                 alignItems="center"
//                 position="absolute"
//                 overflow="clip"
//               >
//                 <OrangeButtonRiveComponent />
//               </Flex>

//               <Flex
//                 w="90%"
//                 direction="row"
//                 justifyContent="center"
//                 alignItems="center"
//               >
//                 <Flex mt="-2px" mr="10px">
//                   <BsCheckCircleFill
//                     size={29}
//                     color="#FFA04C"
//                     style={{
//                       filter:
//                         "drop-shadow(0px 0px 4.968px rgba(247, 147, 26, 0.33))",
//                       fill: "url(#orangeGradient)",
//                     }}
//                   />
//                   <svg width="0" height="0">
//                     <defs>
//                       <linearGradient
//                         id="orangeGradient"
//                         x1="0%"
//                         y1="0%"
//                         x2="0%"
//                         y2="100%"
//                       >
//                         <stop offset="0%" stopColor="#FFA74A" />
//                         <stop offset="100%" stopColor="#EF761A" />
//                       </linearGradient>
//                     </defs>
//                   </svg>
//                 </Flex>
//                 <Text
//                   fontSize="32px"
//                   textAlign="center"
//                   color="#fff"
//                   fontFamily={FONT_FAMILIES.NOSTROMO}
//                 >
//                   {getStatusTitle(state.status)}
//                 </Text>
//               </Flex>
//               <Flex
//                 w="70%"
//                 direction="column"
//                 alignItems="center"
//                 mt="4px"
//                 zIndex="1"
//               >
//                 <Text
//                   fontSize="12.25px"
//                   color="#aaa"
//                   fontFamily={FONT_FAMILIES.AUX_MONO}
//                   fontWeight="normal"
//                   letterSpacing="-1px"
//                   textShadow="0px 2px 4px rgba(0, 0, 0, 0.7)"
//                 >
//                   {getStatusMessage(state.status, state.error)}
//                 </Text>
//               </Flex>

//               {/* PAYMENT DETAILS */}
//               <Flex
//                 w="89%"
//                 direction="row"
//                 justifyContent="space-between"
//                 alignItems="center"
//                 mt="55px"
//                 gap="15px"
//                 zIndex="1"
//               >
//                 <Flex direction="column" w="100%">
//                   <Text
//                     fontFamily={FONT_FAMILIES.NOSTROMO}
//                     fontSize="13px"
//                     mb="7px"
//                     fontWeight="bold"
//                     color="#fff"
//                   >
//                     Status
//                   </Text>
//                   <Button
//                     w="100%"
//                     borderRadius="10px"
//                     px="15px"
//                     py="19px"
//                     fontSize="15px"
//                     fontWeight="normal"
//                     justifyContent="flex-start"
//                     onClick={() =>
//                       window.open(
//                         `https://mempool.space/tx/${txHash}`,
//                         "_blank"
//                       )
//                     }
//                     letterSpacing="-1.5px"
//                     fontFamily={FONT_FAMILIES.AUX_MONO}
//                     border="2px solid rgb(64, 170, 90)"
//                     position="relative"
//                     overflow="hidden"
//                     background="transparent"
//                     boxShadow="0px 2.595px 23.351px 3.243px rgba(59, 59, 59, 0.33)"
//                     color="rgb(235, 255, 236)"
//                     _before={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background: "rgb(4, 36, 20)",
//                       zIndex: -1,
//                       transition: "opacity 0.3s ease",
//                     }}
//                     _hover={{
//                       _before: {
//                         opacity: 0.7,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                     }}
//                     _active={{
//                       _before: {
//                         opacity: 0.7,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                       background: "transparent",
//                     }}
//                     _after={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background: "rgb(6, 46, 26)",
//                       zIndex: -1,
//                       opacity: 0,
//                       transition: "opacity 0.3s ease",
//                     }}
//                   >
//                     <Flex
//                       alignItems="center"
//                       mt="-1px"
//                       mr="8px"
//                       position="relative"
//                       zIndex="1"
//                     >
//                       <BsCheckCircleFill size={15.5} color="rgb(64, 170, 90)" />
//                     </Flex>
//                     <Text mt="0.5px" position="relative" zIndex="1">
//                       {receipt?.status === "success" ? "Confirmed" : "Pending"}
//                     </Text>
//                   </Button>
//                 </Flex>

//                 <Flex direction="column" w="100%">
//                   <Text
//                     fontFamily={FONT_FAMILIES.NOSTROMO}
//                     fontSize="13px"
//                     mb="7px"
//                     fontWeight="bold"
//                     color="#fff"
//                   >
//                     TXN HASH
//                   </Text>
//                   <Button
//                     w="100%"
//                     borderRadius="10px"
//                     px="17px"
//                     py="19px"
//                     fontSize="15px"
//                     fontWeight="normal"
//                     onClick={() =>
//                       window.open(
//                         `https://mempool.space/tx/${txHash}`,
//                         "_blank"
//                       )
//                     }
//                     letterSpacing="-1.5px"
//                     fontFamily={FONT_FAMILIES.AUX_MONO}
//                     border="2px solid #445BCB"
//                     position="relative"
//                     overflow="hidden"
//                     background="transparent"
//                     boxShadow="0px 2.595px 23.351px 3.243px rgba(59, 59, 59, 0.33)"
//                     color="white"
//                     _before={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background: "rgba(50, 66, 168, 0.30)",
//                       zIndex: -1,
//                       transition: "opacity 0.3s ease",
//                     }}
//                     _hover={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                     }}
//                     _active={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                       background: "transparent",
//                     }}
//                     _after={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background: "rgba(50, 66, 168, 0.45)",
//                       zIndex: -1,
//                       opacity: 0,
//                       transition: "opacity 0.3s ease",
//                     }}
//                   >
//                     <Flex
//                       w="100%"
//                       justifyContent="space-between"
//                       alignItems="center"
//                       position="relative"
//                       zIndex="1"
//                     >
//                       <Text mr="10px">{`${txHash.slice(0, 10)}...${txHash.slice(-8)}`}</Text>
//                       <Box
//                         as="span"
//                         cursor="pointer"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           copyToClipboard(
//                             txHash,
//                             "Transaction hash copied to clipboard!"
//                           );
//                         }}
//                       >
//                         <LuCopy color="gray" />
//                       </Box>
//                     </Flex>
//                   </Button>
//                 </Flex>
//                 <Flex direction="column" w="100%" mt="26px">
//                   <Button
//                     onClick={() =>
//                       window.open(
//                         `https://mempool.space/tx/${txHash}`,
//                         "_blank"
//                       )
//                     }
//                     bg={colors.offBlackLighter}
//                     borderWidth="2px"
//                     borderColor={colors.borderGrayLight}
//                     borderRadius="10px"
//                     px="20px"
//                     py="19px"
//                     border="2px solid #445BCB"
//                     position="relative"
//                     overflow="hidden"
//                     background="transparent"
//                     boxShadow="0px 2.595px 23.351px 3.243px rgba(59, 59, 59, 0.33)"
//                     _before={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background: "rgba(50, 66, 168, 0.30)",
//                       zIndex: -1,
//                       transition: "opacity 0.3s ease",
//                     }}
//                     _hover={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                       bg: "transparent",
//                     }}
//                     _active={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                       bg: "transparent",
//                     }}
//                     _after={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background: "rgba(50, 66, 168, 0.45)",
//                       zIndex: -1,
//                       opacity: 0,
//                       transition: "opacity 0.3s ease",
//                     }}
//                   >
//                     <Flex mt="-2px" mr="8px" position="relative" zIndex="1">
//                       <HiOutlineExternalLink
//                         size="16px"
//                         color={colors.offWhite}
//                       />
//                     </Flex>
//                     <Text
//                       fontSize="13px"
//                       color={colors.offWhite}
//                       fontFamily={FONT_FAMILIES.NOSTROMO}
//                       cursor="pointer"
//                       fontWeight="normal"
//                       position="relative"
//                       zIndex="1"
//                     >
//                       View on Mempool
//                     </Text>
//                   </Button>
//                 </Flex>
//               </Flex>

//               <Flex
//                 w="89%"
//                 direction="row"
//                 justifyContent="space-between"
//                 alignItems="center"
//                 mt="25px"
//                 zIndex="1"
//               >
//                 <Flex direction="column" w="64%">
//                   <Text
//                     fontFamily={FONT_FAMILIES.NOSTROMO}
//                     fontSize="13px"
//                     mb="7px"
//                     fontWeight="bold"
//                     color="#fff"
//                   >
//                     Your Address
//                   </Text>
//                   <Button
//                     w="100%"
//                     borderRadius="10px"
//                     px="17px"
//                     py="19px"
//                     fontSize="15px"
//                     onClick={() =>
//                       window.open(
//                         "https://mempool.space/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
//                         "_blank"
//                       )
//                     }
//                     fontWeight="normal"
//                     letterSpacing="-1.5px"
//                     fontFamily={FONT_FAMILIES.AUX_MONO}
//                     border="2px solid #FF9E38"
//                     position="relative"
//                     overflow="hidden"
//                     color="white"
//                     background="transparent"
//                     boxShadow="0px 2.566px 23.096px 3.208px rgba(254, 157, 56, 0.29)"
//                     backdropFilter="blur(32.00636672973633px)"
//                     _before={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background:
//                         "linear-gradient(0deg, rgba(242, 119, 31, 0.16) 0%, rgba(111, 44, 15, 0.12) 100%)",
//                       zIndex: -1,
//                       transition: "opacity 0.3s ease",
//                     }}
//                     _hover={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                     }}
//                     _active={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                       background: "transparent",
//                     }}
//                     _after={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background:
//                         "linear-gradient(0deg, rgba(242, 119, 31, 0.25) 0%, rgba(111, 44, 15, 0.2) 100%)",
//                       zIndex: -1,
//                       opacity: 0,
//                       transition: "opacity 0.3s ease",
//                     }}
//                   >
//                     <Flex
//                       w="100%"
//                       justifyContent="space-between"
//                       alignItems="center"
//                       position="relative"
//                       zIndex="1"
//                     >
//                       <Text>bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</Text>
//                       <Text
//                         ml="-35px"
//                         fontFamily={FONT_FAMILIES.AUX_MONO}
//                         fontSize="13px"
//                         fontWeight="normal"
//                         color="#999"
//                       >
//                         P2PKSH
//                       </Text>
//                       <Box
//                         as="span"
//                         cursor="pointer"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           copyToClipboard(
//                             "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
//                             "Bitcoin address copied to clipboard"
//                           );
//                         }}
//                       >
//                         <LuCopy color="gray" />
//                       </Box>
//                     </Flex>
//                   </Button>
//                 </Flex>
//                 <Flex direction="column" w="33.5%">
//                   <Text
//                     fontFamily={FONT_FAMILIES.NOSTROMO}
//                     fontSize="13px"
//                     mb="7px"
//                     fontWeight="bold"
//                     color="#fff"
//                   >
//                     BALANCE
//                   </Text>

//                   <Button
//                     w="100%"
//                     borderRadius="10px"
//                     px="17px"
//                     py="19px"
//                     fontSize="15px"
//                     fontWeight="normal"
//                     letterSpacing="-1.5px"
//                     fontFamily={FONT_FAMILIES.AUX_MONO}
//                     border="2px solid #FF9E38"
//                     position="relative"
//                     overflow="hidden"
//                     background="transparent"
//                     color="white"
//                     onClick={() =>
//                       window.open(
//                         "https://mempool.space/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
//                         "_blank"
//                       )
//                     }
//                     boxShadow="0px 2.566px 23.096px 3.208px rgba(254, 157, 56, 0.29)"
//                     backdropFilter="blur(32.00636672973633px)"
//                     _before={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background:
//                         "linear-gradient(0deg, rgba(242, 119, 31, 0.16) 0%, rgba(111, 44, 15, 0.12) 100%)",
//                       zIndex: -1,
//                       transition: "opacity 0.3s ease",
//                     }}
//                     _hover={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                     }}
//                     _active={{
//                       _before: {
//                         opacity: 0,
//                       },
//                       _after: {
//                         opacity: 1,
//                       },
//                       background: "transparent",
//                     }}
//                     _after={{
//                       content: '""',
//                       position: "absolute",
//                       top: 0,
//                       left: 0,
//                       right: 0,
//                       bottom: 0,
//                       background:
//                         "linear-gradient(0deg, rgba(242, 119, 31, 0.25) 0%, rgba(111, 44, 15, 0.2) 100%)",
//                       zIndex: -1,
//                       opacity: 0,
//                       transition: "opacity 0.3s ease",
//                     }}
//                   >
//                     <Flex
//                       w="100%"
//                       alignItems="center"
//                       position="relative"
//                       zIndex="1"
//                     >
//                       <Text
//                         ml="8px"
//                         letterSpacing="-1.5px"
//                         fontFamily={FONT_FAMILIES.AUX_MONO}
//                         fontSize="16px"
//                         fontWeight="normal"
//                       >
//                         ₿ 1.20240252
//                       </Text>
//                       <Box flex="1" />
//                       <Text
//                         ml="15px"
//                         fontFamily={FONT_FAMILIES.AUX_MONO}
//                         fontSize="13px"
//                         fontWeight="normal"
//                         color="#999"
//                       >
//                         $121,355.63
//                       </Text>
//                     </Flex>
//                   </Button>
//                 </Flex>
//               </Flex>
//               <Flex
//                 mt="75px"
//                 gap="10px"
//                 direction="column"
//                 alignItems="center"
//                 zIndex="1"
//               >
//                 <Button
//                   borderRadius="12px"
//                   h="40px"
//                   onClick={() => (window.location.href = "/")}
//                   px="45px"
//                   border="2px solid #FF9E38"
//                   position="relative"
//                   overflow="hidden"
//                   background="transparent"
//                   boxShadow="0px 2.3px 20.7px 2.875px rgba(254, 157, 56, 0.38)"
//                   backdropFilter="blur(28.685392379760742px)"
//                   _before={{
//                     content: '""',
//                     position: "absolute",
//                     top: 0,
//                     left: 0,
//                     right: 0,
//                     bottom: 0,
//                     background:
//                       "linear-gradient(0deg, rgba(255, 80, 2, 0.35) 0%, rgba(111, 44, 15, 0.12) 100%)",
//                     zIndex: -1,
//                     transition: "opacity 0.3s ease",
//                   }}
//                   _hover={{
//                     _before: {
//                       opacity: 0,
//                     },
//                     _after: {
//                       opacity: 1,
//                     },
//                   }}
//                   _active={{
//                     _before: {
//                       opacity: 0,
//                     },
//                     _after: {
//                       opacity: 1,
//                     },
//                     background: "transparent",
//                   }}
//                   _after={{
//                     content: '""',
//                     position: "absolute",
//                     top: 0,
//                     left: 0,
//                     right: 0,
//                     bottom: 0,
//                     background:
//                       "linear-gradient(0deg, rgba(255, 80, 2, 0.45) 0%, rgba(111, 44, 15, 0.2) 100%)",
//                     zIndex: -1,
//                     opacity: 0,
//                     transition: "opacity 0.3s ease",
//                   }}
//                 >
//                   <Flex mt="-1px" mr="6px" position="relative" zIndex="1">
//                     <GoHomeFill size="15px" color={colors.offWhite} />
//                   </Flex>
//                   <Text
//                     fontSize="14px"
//                     color={colors.offWhite}
//                     fontFamily={FONT_FAMILIES.NOSTROMO}
//                     cursor="pointer"
//                     fontWeight="normal"
//                     position="relative"
//                     zIndex="1"
//                   >
//                     HOME
//                   </Text>
//                 </Button>
//               </Flex>
//             </Flex>

//             {/* DEBUG TEXT */}
//             <Text
//               fontSize="12px"
//               fontFamily={FONT_FAMILIES.AUX_MONO}
//               color={colors.red}
//               mt="15px"
//               textAlign="center"
//             >
//               DEBUG - PAYMENT RECEIVED: Current Status = "{state.status}"
//             </Text>
//           </Flex>
//         )}

//         {/* DEFAULT/OTHER STATES */}
//         {!isFindingLiquidityState(state.status) &&
//           !isAwaitingPaymentState(state.status) &&
//           !isPaymentReceivedState(state.status) && (
//             <Flex
//               direction="column"
//               align="center"
//               py={isMobile ? "20px" : "27px"}
//               w={isMobile ? "100%" : "630px"}
//               borderRadius="30px"
//               {...opaqueBackgroundColor}
//               borderBottom={borderColor}
//               borderLeft={borderColor}
//               borderTop={borderColor}
//               borderRight={borderColor}
//             >
//               <Flex
//                 w="91.5%"
//                 direction="column"
//                 align="center"
//                 justify="center"
//               >
//                 <Text
//                   fontSize="24px"
//                   fontFamily={FONT_FAMILIES.NOSTROMO}
//                   color={getStatusColor(state.status)}
//                   mb="20px"
//                   textAlign="center"
//                 >
//                   {getStatusTitle(state.status)}
//                 </Text>

//                 {state.status === "validating_tx" ? (
//                   <Flex direction="column" align="center" mb="30px">
//                     <Spinner size="lg" color={colors.greenOutline} mb="20px" />
//                     <Text
//                       fontSize="14px"
//                       fontFamily={FONT_FAMILIES.AUX_MONO}
//                       color={colors.textGray}
//                       textAlign="center"
//                     >
//                       {getStatusMessage(state.status, state.error)}
//                     </Text>
//                   </Flex>
//                 ) : (
//                   <Text
//                     fontSize="14px"
//                     fontFamily={FONT_FAMILIES.AUX_MONO}
//                     color={colors.textGray}
//                     mb="30px"
//                     textAlign="center"
//                   >
//                     {getStatusMessage(state.status, state.error)}
//                   </Text>
//                 )}

//                 {/* Debug: Display raw status */}
//                 <Text
//                   fontSize="12px"
//                   fontFamily={FONT_FAMILIES.AUX_MONO}
//                   color={colors.red}
//                   mb="15px"
//                   textAlign="center"
//                 >
//                   DEBUG: {state.status}
//                 </Text>

//                 <Box
//                   bg="rgba(46, 29, 14, 0.66)"
//                   border="2px solid #78491F"
//                   borderRadius="16px"
//                   px="20px"
//                   py="20px"
//                   w="100%"
//                   maxW="500px"
//                 >
//                   <Text
//                     fontSize="14px"
//                     fontFamily={FONT_FAMILIES.AUX_MONO}
//                     color={colors.textGray}
//                     mb="10px"
//                     textAlign="center"
//                   >
//                     Transaction Hash:
//                   </Text>

//                   <Text
//                     fontSize={isMobile ? "12px" : "14px"}
//                     fontFamily={FONT_FAMILIES.AUX_MONO}
//                     color={colors.offWhite}
//                     textAlign="center"
//                     wordBreak="break-all"
//                     letterSpacing="-0.5px"
//                     mb="15px"
//                   >
//                     {txHash}
//                   </Text>

//                   {receipt && (
//                     <>
//                       <Text
//                         fontSize="14px"
//                         fontFamily={FONT_FAMILIES.AUX_MONO}
//                         color={colors.textGray}
//                         mb="5px"
//                         textAlign="center"
//                       >
//                         Block Number: {receipt.blockNumber?.toString()}
//                       </Text>
//                       <Text
//                         fontSize="14px"
//                         fontFamily={FONT_FAMILIES.AUX_MONO}
//                         color={colors.textGray}
//                         textAlign="center"
//                       >
//                         Status:{" "}
//                         <Text
//                           as="span"
//                           color={
//                             receipt.status === "success"
//                               ? colors.greenOutline
//                               : colors.red
//                           }
//                         >
//                           {receipt.status === "success"
//                             ? "Success"
//                             : "Reverted"}
//                         </Text>
//                       </Text>
//                       {auctionIndex !== null && (
//                         <Text
//                           fontSize="14px"
//                           fontFamily={FONT_FAMILIES.AUX_MONO}
//                           color={colors.textGray}
//                           textAlign="center"
//                           mt="5px"
//                         >
//                           Auction Index: {auctionIndex.toString()}
//                         </Text>
//                       )}
//                     </>
//                   )}
//                 </Box>
//               </Flex>
//             </Flex>
//           )}
//       </Flex>
//     </Flex>
//   );
// };

// export const getServerSideProps: GetServerSideProps = async (context) => {
//   const { txHash, chainId } = context.params!;

//   // Basic validation that txHash is a string and looks like a transaction hash
//   if (
//     !txHash ||
//     typeof txHash !== "string" ||
//     !/^0x[a-fA-F0-9]{64}$/.test(txHash)
//   ) {
//     return {
//       notFound: true,
//     };
//   }

//   // Validate chainId
//   const parsedChainId = parseInt(chainId as string, 10);
//   if (isNaN(parsedChainId)) {
//     return {
//       notFound: true,
//     };
//   }

//   return {
//     props: {
//       txHash,
//       chainId: parsedChainId,
//     },
//   };
// };

// export default SwapSuccessPage;
