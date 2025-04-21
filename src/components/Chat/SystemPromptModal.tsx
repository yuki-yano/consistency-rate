import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
} from "@chakra-ui/react";
import { FC } from "react";

import { useSystemPrompt } from "../../hooks/useSystemPrompt";

type SystemPromptModalProps = {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemPromptModal: FC<SystemPromptModalProps> = ({ isOpen, onClose }) => {
  const { handleResetToDefault, handleSave, localPrompt, setLocalPrompt } = useSystemPrompt(isOpen);

  return (
    <Modal blockScrollOnMount={false} isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent mx={8}>
        <ModalHeader>システムプロンプト編集</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Textarea
            minHeight="300px"
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="システムプロンプトを入力..."
            size="sm"
            value={localPrompt}
          />
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="gray" mr="auto" onClick={handleResetToDefault} size="sm" variant="outline">
            デフォルトに戻す
          </Button>
          <Button mr={3} onClick={onClose} size="sm" variant="outline">
            キャンセル
          </Button>
          <Button
            _hover={{
              bg: 'blue.600',
            }}
            bg="blue.500"
            color="white"
            colorScheme="blue"
            onClick={() => handleSave(onClose)}
            size="sm"
          >
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 