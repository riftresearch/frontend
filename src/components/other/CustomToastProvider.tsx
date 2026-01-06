import { Toaster } from "react-hot-toast";
import { colors } from "@/utils/colors";
import { Flex, Text } from "@chakra-ui/react";
import { MdClose } from "react-icons/md";
import { toast } from "react-hot-toast";
import { ToastBar } from "react-hot-toast";

export const CustomToastProvider = () => {
  return (
    <Toaster
      toastOptions={{
        position: "bottom-center",
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
          minWidth: "300px",
          maxWidth: "500px",
          transition: "0.2s all ease-in-out",
          minHeight: "50px",
          zIndex: 2,
        },
        success: {
          style: {
            // backgroundColor: '#2ECC40',
            // background: 'linear-gradient(155deg, rgba(23,139,11,1) 0%, rgba(33,150,34,1) 42%, rgba(46,204,64,1) 100%)',
            background: colors.toast.success,
          },
          iconTheme: {
            primary: colors.offWhite,
            secondary: colors.toast.success,
          },
          duration: 2000,
        },
        loading: {
          style: {
            // background: 'linear-gradient(155deg, rgba(20,41,77,1) 0%, rgba(45,102,196,1) 42%, rgba(48,123,244,1) 100%)',
            background: colors.toast.info,
          },
        },
        error: {
          style: {
            // background: 'linear-gradient(155deg, rgba(140,29,30,1) 0%, rgba(163,23,24,1) 42%, rgba(219,0,2,1) 100%)',
            background: colors.toast.error,
          },
          iconTheme: {
            primary: colors.offWhite,
            secondary: colors.toast.error,
          },
          duration: 4000,
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => {
            const messages = (message as any).props.children.split(";;");
            const title = messages[0];
            const description = messages.length > 1 ? messages[1] : null;
            return (
              <Flex align="center" w="100%" gap="8px">
                <Flex fontFamily={"Aux"} align="center" justify="center" flexShrink={0}>
                  {icon}
                </Flex>
                <Flex flex={1} flexDir="column" minW={0}>
                  <Text fontFamily={"Aux"} fontSize="0.9rem" fontWeight="600" noOfLines={1}>
                    {title}
                  </Text>
                  {description && description != "undefined" && (
                    <Text
                      fontFamily={"Aux"}
                      fontSize="0.8rem"
                      fontWeight="300"
                      color={colors.offWhite}
                      noOfLines={1}
                    >
                      {description}
                    </Text>
                  )}
                </Flex>
                {t.type !== "loading" && (
                  <Flex
                    p="3px"
                    cursor="pointer"
                    onClick={() => toast.dismiss(t.id)}
                    color={colors.offWhite}
                    transition="0.2s color ease-in-out"
                    flexShrink={0}
                    _hover={{
                      color: colors.textGray,
                    }}
                  >
                    <MdClose />
                  </Flex>
                )}
              </Flex>
            );
          }}
        </ToastBar>
      )}
    </Toaster>
  );
};
