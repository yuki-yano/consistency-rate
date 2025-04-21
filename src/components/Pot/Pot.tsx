import type { FC } from "react";

import {
  Box,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormLabel,
  Heading,
} from "@chakra-ui/react";
import { Select as MultiSelect } from "chakra-react-select";
import { useAtom } from "jotai";

import { potAtom } from "../../state";
import { multiSelectStyles } from "../../theme";

export const Pot: FC = () => {
  const [potState, setPotState] = useAtom(potAtom);
  const prosperity = potState.prosperity;
  const desiresOrExtravagance = potState.desiresOrExtravagance;

  return (
    <Card>
      <CardBody>
        <Heading as="h2" fontSize="lg" py={2}>
          各種壺
        </Heading>

        <Box gap={2}>
          <Flex direction="column" gap={2}>
            <Card shadow="xs">
              <CardBody>
                <Heading as="h3" fontSize="md" pb={2}>
                  金満で謙虚な壺
                </Heading>

                <Flex gap={2}>
                  <FormControl>
                    <FormLabel>枚数</FormLabel>
                    <MultiSelect
                      chakraStyles={multiSelectStyles}
                      isClearable={false}
                      menuPortalTarget={document.body}
                      onChange={(selectedValue) => {
                        setPotState({
                          ...potState,
                          prosperity: {
                            ...prosperity,
                            count: Number(
                              (selectedValue as { label: string; value: string })
                                .value
                            ),
                          },
                        });
                      }}
                      options={[
                        { label: "0", value: "0" },
                        { label: "1", value: "1" },
                        { label: "2", value: "2" },
                        { label: "3", value: "3" },
                      ]}
                      value={[
                        {
                          label: prosperity.count.toString(),
                          value: prosperity.count.toString(),
                        },
                      ]}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>コスト</FormLabel>
                    <MultiSelect
                      chakraStyles={multiSelectStyles}
                      isClearable={false}
                      menuPortalTarget={document.body}
                      onChange={(selectedValue) => {
                        setPotState({
                          ...potState,
                          prosperity: {
                            ...prosperity,
                            cost: Number(
                              (selectedValue as { label: string; value: string })
                                .value
                            ) as 3 | 6,
                          },
                        });
                      }}
                      options={[
                        { label: "3", value: "3" },
                        { label: "6", value: "6" },
                      ]}
                      value={[
                        {
                          label: prosperity.cost.toString(),
                          value: prosperity.cost.toString(),
                        },
                      ]}
                    />
                  </FormControl>
                </Flex>
              </CardBody>
            </Card>

            <Card shadow="xs">
              <CardBody>
                <Heading as="h3" fontSize="md" pb={2}>
                  強欲で貪欲な壺, 強欲で金満な壺
                </Heading>

                <Flex gap={2}>
                  <FormControl>
                    <FormLabel>枚数</FormLabel>
                    <MultiSelect
                      chakraStyles={multiSelectStyles}
                      isClearable={false}
                      menuPortalTarget={document.body}
                      onChange={(selectedValue) => {
                        setPotState({
                          ...potState,
                          desiresOrExtravagance: {
                            ...desiresOrExtravagance,
                            count: Number(
                              (selectedValue as { label: string; value: string })
                                .value
                            ),
                          },
                        });
                      }}
                      options={[
                        { label: "0", value: "0" },
                        { label: "1", value: "1" },
                        { label: "2", value: "2" },
                        { label: "3", value: "3" },
                        { label: "4", value: "4" },
                        { label: "5", value: "5" },
                        { label: "6", value: "6" },
                      ]}
                      value={[
                        {
                          label: desiresOrExtravagance.count.toString(),
                          value: desiresOrExtravagance.count.toString(),
                        },
                      ]}
                    />
                  </FormControl>
                </Flex>
              </CardBody>
            </Card>
          </Flex>
        </Box>
      </CardBody>
    </Card>
  );
}; 