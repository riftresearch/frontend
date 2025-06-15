import { Flex, Text, Image } from "@chakra-ui/react";
import { Sling as Hamburger } from "hamburger-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import router from "next/router";
import NavItem from "./NavItem";
import { RouteButton, ROUTES } from "@/utils/types";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";

interface NavHeaderProps {
  isOpen?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
}
const NavHeader: React.FC<NavHeaderProps> = ({}) => {
  const { isTablet, isMobile, contentWidth, isMonoScroll } = useWindowSize();

  const [isOpen, setOpen] = useState(false);
  const [hideItems, setHideItems] = useState(false);

  const animationDelay = {
    num: 300,
    transition: "0.3s ease-in-out all",
  };

  useEffect(() => {
    setTimeout(() => setHideItems(!isOpen), isOpen ? 100 : animationDelay.num);
  }, [isOpen, animationDelay.num]);

  if (isTablet)
    return (
      <Flex
        w="100%"
        h={isOpen ? "100vh" : "50px"}
        align="center"
        // justify='center'
        flexDir="column"
        backdropFilter="blur(8px)"
        bgGradient={colors.gradient.mobileNav}
        transition="0.4s ease-in-out all"
      >
        <Flex w={contentWidth} flex={1} align="flex-start" flexDir="column">
          <Flex
            w="100%"
            px="20px"
            py="0px"
            align="center"
            justify="space-between"
          >
            <Image
              src="/images/logos/rift.svg"
              h="13px"
              alt="Rift"
              userSelect="none"
            />
            <Hamburger
              toggled={isOpen}
              toggle={setOpen}
              size={18}
              rounded
              label="Show Menu"
              color="white"
            />
          </Flex>
          {/* How do i make this component below fade in? it currently does not fade in, but it does fade out correctly */}
          {!hideItems && (
            <Flex
              flex={1}
              align="flex-start"
              mt="40px"
              w="100%"
              transition={animationDelay.transition}
              opacity={isOpen && !hideItems ? 1 : 0}
              pointerEvents={isOpen && !hideItems ? "auto" : "none"}
            >
              <Flex
                flexDir="column"
                justify="space-around"
                px="20px"
                w="100%"
                gap="20px"
              >
                {(Object.keys(ROUTES) as RouteButton[]).map((name) => {
                  const url = ROUTES[name];
                  return (
                    <NavItem
                      key={name}
                      buttonName={name}
                      onClick={() => {
                        try {
                          setOpen(false);
                          setTimeout(
                            () => setHideItems(true),
                            animationDelay.num
                          );
                          router.push(url);
                        } catch (error) {
                          console.error(error);
                        }
                      }}
                    />
                  );
                })}
              </Flex>
            </Flex>
          )}
        </Flex>
        <Flex
          w="100%"
          h="1px"
          bgGradient={`linear-gradient(90deg, ${colors.RiftBlue} 0%, ${colors.RiftOrange} 100%)`}
          opacity={0.6}
        />
      </Flex>
    );
};

export default NavHeader;
